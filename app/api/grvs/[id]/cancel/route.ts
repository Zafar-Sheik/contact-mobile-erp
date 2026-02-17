import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/grvs/:id/cancel - Cancel a posted GRV
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const grv = await GRV.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!grv) {
    return NextResponse.json({ error: "GRV not found" }, { status: 404 });
  }

  if (grv.status !== "Posted") {
    return NextResponse.json({ error: "Only posted GRVs can be cancelled" }, { status: 400 });
  }

  // Get existing movements for this GRV
  const existingMovements = await InventoryMovement.find({
    sourceType: "GRV",
    sourceId: grv._id,
    companyId: session.companyId,
    isDeleted: false,
  });

  if (existingMovements.length === 0) {
    return NextResponse.json({ error: "No inventory movements found for this GRV" }, { status: 400 });
  }

  // Create reverse movements and update stock
  const reverseMovements = [];
  const stockItemUpdates = [];

  // Group movements by stock item to calculate correct quantities
  const movementsByItem: Record<string, typeof existingMovements> = {};
  for (const movement of existingMovements) {
    const itemId = movement.stockItemId.toString();
    if (!movementsByItem[itemId]) {
      movementsByItem[itemId] = [];
    }
    movementsByItem[itemId].push(movement);
  }

  for (const itemId in movementsByItem) {
    const itemMovements = movementsByItem[itemId];
    const totalReceivedQty = itemMovements.reduce((sum, m) => sum + m.quantity, 0);
    
    const stockItem = await StockItem.findById(itemId);
    if (!stockItem) {
      return NextResponse.json({ error: `Stock item not found: ${itemId}` }, { status: 400 });
    }

    const currentOnHand = stockItem.inventory?.onHand || 0;
    const currentAvgCost = stockItem.pricing?.averageCostCents || 0;

    // Check if there's enough stock to reverse
    if (currentOnHand < totalReceivedQty) {
      console.warn(`Stock item ${itemId} has only ${currentOnHand} on hand, but GRV added ${totalReceivedQty}. Limiting cancel to available stock.`);
    }

    // Calculate the actual quantity we can reverse (can't go below 0)
    const actualReversalQty = Math.min(currentOnHand, totalReceivedQty);
    const newOnHand = currentOnHand - actualReversalQty;

    // Calculate new average cost after removing received quantity
    let newAvgCost = currentAvgCost;
    if (newOnHand > 0 && currentOnHand > 0 && actualReversalQty > 0 && totalReceivedQty > 0) {
      // Recalculate average cost based on actual reversal
      const totalReceivedCost = itemMovements.reduce(
        (sum, m) => sum + (m.quantity * (m.unitCostCents || 0)), 
        0
      );
      // Ensure we don't calculate negative costs
      const currentStockValue = currentOnHand * currentAvgCost;
      const reversalValue = Math.round((actualReversalQty / totalReceivedQty) * totalReceivedCost);
      const newStockValue = Math.max(0, currentStockValue - reversalValue);
      newAvgCost = Math.round(newStockValue / newOnHand);
    } else {
      newAvgCost = currentAvgCost; // Keep last cost if stock runs out
    }

    // Ensure costAfterCents is never negative
    newAvgCost = Math.max(0, newAvgCost);

    // Create reverse inventory movement for each original movement
    for (const movement of itemMovements) {
      // Calculate proportional quantity for this movement
      const proportion = actualReversalQty / totalReceivedQty;
      const reverseQty = Math.round(movement.quantity * proportion);
      const quantityAfter = currentOnHand - reverseQty;

      const reverseMovement = new InventoryMovement({
        stockItemId: movement.stockItemId,
        locationId: movement.locationId,
        locationName: movement.locationName,
        sourceType: "CANCEL_GRV",
        sourceId: grv._id,
        sourceLineId: movement.sourceLineId,
        movementType: "OUT",
        quantity: reverseQty,
        unitCostCents: movement.unitCostCents,
        batchNumber: movement.batchNumber,
        expiryDate: movement.expiryDate,
        serialNumbers: movement.serialNumbers,
        quantityBefore: currentOnHand,
        quantityAfter: Math.max(0, quantityAfter), // Ensure non-negative
        costBeforeCents: currentAvgCost,
        costAfterCents: newAvgCost,
        companyId: session.companyId,
        createdBy: session.userId,
        updatedBy: session.userId,
      });
      reverseMovements.push(reverseMovement);
    }

    // Update stock item
    stockItemUpdates.push({
      updateOne: {
        filter: { _id: itemId },
        update: {
          $inc: { "inventory.onHand": -actualReversalQty },
          $set: {
            "pricing.averageCostCents": newAvgCost,
            updatedBy: session.userId,
          },
        },
      },
    });
  }

  // Bulk insert reverse movements and update stock items
  if (reverseMovements.length > 0) {
    await InventoryMovement.insertMany(reverseMovements);
    if (stockItemUpdates.length > 0) {
      await StockItem.bulkWrite(stockItemUpdates);
    }
  }

  // Update GRV status to Cancelled
  grv.status = "Cancelled";
  grv.updatedBy = session.userId;
  await grv.save();

  return NextResponse.json({ 
    message: "GRV cancelled successfully",
    data: grv,
    reverseMovementsCreated: reverseMovements.length 
  });
}

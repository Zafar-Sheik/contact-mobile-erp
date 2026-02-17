import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";
import mongoose from "mongoose";

// POST /api/grvs/:id/post - Post/Confirm GRV
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

  if (grv.status !== "Draft") {
    return NextResponse.json({ error: "GRV is not in Draft status" }, { status: 400 });
  }

  if (!grv.supplierId || !grv.lines || grv.lines.length === 0) {
    return NextResponse.json({ error: "GRV must have a supplier and at least one line item" }, { status: 400 });
  }

  console.log("Processing GRV:", grv.grvNumber);
  console.log("Lines:", grv.lines.length);

  // Process each line
  for (let i = 0; i < grv.lines.length; i++) {
    const line = grv.lines[i];
    console.log(`Line ${i + 1}:`, {
      stockItemId: line.stockItemId,
      receivedQty: line.receivedQty,
      unitCostCents: line.unitCostCents
    });

    // Ensure stockItemId is a valid ObjectId
    let itemId = line.stockItemId;
    if (!itemId) {
      console.error(`Line ${i + 1}: No stockItemId`);
      return NextResponse.json({ error: `Line ${i + 1}: No stock item selected` }, { status: 400 });
    }

    // Find the stock item
    const stockItem = await StockItem.findById(itemId);
    if (!stockItem) {
      console.error(`Line ${i + 1}: Stock item not found:`, itemId);
      return NextResponse.json({ error: `Line ${i + 1}: Stock item not found` }, { status: 400 });
    }

    console.log("Found stock item:", stockItem.name, {
      onHand: stockItem.inventory?.onHand,
      avgCost: stockItem.pricing?.averageCostCents
    });

    // Get current values with defaults
    const currentOnHand = stockItem.inventory?.onHand || 0;
    const currentAvgCost = stockItem.pricing?.averageCostCents || 0;
    const receivedQty = line.receivedQty || 0;
    const receivedCost = line.unitCostCents || 0;

    // Calculate new average cost (Weighted Average Cost)
    let newAvgCost = currentAvgCost;
    if (currentOnHand + receivedQty > 0) {
      newAvgCost = Math.round(
        ((currentOnHand * currentAvgCost) + (receivedQty * receivedCost)) / (currentOnHand + receivedQty)
      );
    }

    console.log("Calculated:", { currentOnHand, currentAvgCost, receivedQty, receivedCost, newAvgCost });

    // Create inventory movement
    const movement = new InventoryMovement({
      stockItemId: itemId,
      locationId: grv.locationId || "main",
      locationName: grv.locationName || "Main Warehouse",
      sourceType: "GRV",
      sourceId: grv._id,
      sourceLineId: line._id,
      movementType: "IN",
      quantity: receivedQty,
      unitCostCents: receivedCost,
      batchNumber: line.batchNumber || "",
      expiryDate: line.expiryDate || null,
      serialNumbers: line.serialNumbers || [],
      quantityBefore: currentOnHand,
      quantityAfter: currentOnHand + receivedQty,
      costBeforeCents: currentAvgCost,
      costAfterCents: newAvgCost,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    await movement.save();
    console.log("Movement saved:", movement._id);

    // Update stock item using explicit update
    const newOnHand = currentOnHand + receivedQty;
    
    await StockItem.updateOne(
      { _id: itemId },
      {
        $inc: { "inventory.onHand": receivedQty },
        $set: {
          "pricing.averageCostCents": newAvgCost,
          "pricing.costPriceCents": receivedCost,
          updatedBy: session.userId
        }
      }
    );
    
    console.log("Stock item updated:", itemId, { newOnHand, newAvgCost });
  }

  // Update GRV status
  grv.status = "Posted";
  grv.postedAt = new Date();
  grv.postedBy = session.userId;
  await grv.save();

  console.log("GRV posted successfully:", grv.grvNumber);

  return NextResponse.json({ 
    message: "GRV posted successfully",
    data: grv,
    linesProcessed: grv.lines.length
  });
}

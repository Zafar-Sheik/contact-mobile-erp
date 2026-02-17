import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const grv = await GRV.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .populate("supplierId", "name email phone")
    .lean();

  if (!grv) {
    return NextResponse.json({ error: "GRV not found" }, { status: 404 });
  }

  return NextResponse.json({ data: grv });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Check if GRV exists and is in Draft status
  const existingGRV = await GRV.findOne({ _id: id, companyId: session.companyId, isDeleted: false });
  if (!existingGRV) {
    return NextResponse.json({ error: "GRV not found" }, { status: 404 });
  }

  if (existingGRV.status !== "Draft") {
    return NextResponse.json({ error: "Cannot edit a Posted or Cancelled GRV" }, { status: 400 });
  }

  // Recalculate totals if lines provided
  let subtotalCents = 0;
  let vatTotalCents = 0;
  let discountTotalCents = 0;

  if (body.lines) {
    body.lines = body.lines.map((line: any, index: number) => {
      const receivedQty = line.receivedQty || 0;
      const unitCostCents = line.unitCostCents || 0;
      
      let discountCents = 0;
      if (line.discountType === "percent" && line.discountValue) {
        discountCents = Math.round((unitCostCents * receivedQty * line.discountValue) / 100);
      } else if (line.discountType === "amount") {
        discountCents = line.discountValue * receivedQty;
      }

      const lineSubtotal = (unitCostCents * receivedQty) - discountCents;
      const vatRate = line.itemSnapshot?.vatRate || 15;
      const vatAmount = Math.round(lineSubtotal * (vatRate / 100));
      const lineTotal = lineSubtotal + vatAmount;

      subtotalCents += lineSubtotal;
      vatTotalCents += vatAmount;
      discountTotalCents += discountCents;

      return {
        lineNo: index + 1,
        ...line,
        subtotalCents: lineSubtotal,
        vatAmountCents: vatAmount,
        totalCents: lineTotal,
      };
    });

    body.subtotalCents = subtotalCents;
    body.vatTotalCents = vatTotalCents;
    body.discountTotalCents = discountTotalCents;
    body.grandTotalCents = subtotalCents + vatTotalCents - discountTotalCents;
  }

  const grv = await GRV.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!grv) {
    return NextResponse.json({ error: "GRV not found" }, { status: 404 });
  }

  return NextResponse.json({ data: grv });
}

export async function DELETE(
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
    return NextResponse.json({ error: "Cannot delete a Posted or Cancelled GRV" }, { status: 400 });
  }

  await grv.softDelete(session.userId);

  return NextResponse.json({ message: "GRV deleted successfully" });
}

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

  // Validate stock items and create movements
  const movements = [];
  const stockItemUpdates = [];

  for (const line of grv.lines) {
    const stockItem = await StockItem.findById(line.stockItemId);
    if (!stockItem) {
      return NextResponse.json({ error: `Stock item not found: ${line.stockItemId}` }, { status: 400 });
    }

    // Calculate new average cost (Weighted Average Cost)
    const currentOnHand = stockItem.inventory?.onHand || 0;
    const currentAvgCost = stockItem.pricing?.averageCostCents || 0;
    const receivedQty = line.receivedQty;
    const receivedCost = line.unitCostCents;

    let newAvgCost = currentAvgCost;
    if (currentOnHand + receivedQty > 0) {
      newAvgCost = Math.round(
        ((currentOnHand * currentAvgCost) + (receivedQty * receivedCost)) / (currentOnHand + receivedQty)
      );
    }

    // Create inventory movement
    const movement = new InventoryMovement({
      stockItemId: line.stockItemId,
      locationId: grv.locationId,
      locationName: grv.locationName,
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
    movements.push(movement);

    // Update stock item
    stockItemUpdates.push({
      updateOne: {
        filter: { _id: line.stockItemId },
        update: {
          $inc: { "inventory.onHand": receivedQty },
          $set: {
            "pricing.averageCostCents": newAvgCost,
            "pricing.costPriceCents": receivedCost,
            updatedBy: session.userId,
          },
        },
      },
    });
  }

  // Bulk insert movements and update stock items
  if (movements.length > 0) {
    await InventoryMovement.insertMany(movements);
    if (stockItemUpdates.length > 0) {
      await StockItem.bulkWrite(stockItemUpdates);
    }
  }

  // Update GRV status
  grv.status = "Posted";
  grv.postedAt = new Date();
  grv.postedBy = session.userId;
  await grv.save();

  return NextResponse.json({ 
    message: "GRV posted successfully",
    data: grv,
    movementsCreated: movements.length 
  });
}

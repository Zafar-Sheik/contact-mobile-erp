import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

// GET /api/supplier-bills/[id] - Get a single supplier bill by ID
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bill = await SupplierBill.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    })
      .populate("supplierId", "name email phone address")
      .populate("poId", "poNumber")
      .populate("grvIds", "grvNumber")
      .populate("billLines.stockItemId", "sku name unit")
      .populate("billLines.grvId", "grvNumber")
      .lean();

    if (!bill) {
      return NextResponse.json({ error: "Supplier bill not found" }, { status: 404 });
    }

    return NextResponse.json({ data: bill });
  } catch (error: any) {
    console.error("Error fetching supplier bill:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch supplier bill" }, { status: 500 });
  }
}

// PUT /api/supplier-bills/[id] - Update a supplier bill (only Draft status can be edited)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Check if bill exists and is in Draft status
    const existingBill = await SupplierBill.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!existingBill) {
      return NextResponse.json({ error: "Supplier bill not found" }, { status: 404 });
    }

    if (existingBill.status !== "Draft") {
      return NextResponse.json(
        { error: "Only Draft status bills can be edited" },
        { status: 400 }
      );
    }

    // If updating lines, recalculate totals
    if (body.billLines) {
      let subtotalCents = 0;
      let vatTotalCents = 0;
      const discountCents = body.discountCents ?? existingBill.discountCents;

      const processedLines = await Promise.all(
        body.billLines.map(async (line: any, index: number) => {
          const quantity = line.quantity || 0;
          const unitCostCents = line.unitCostCents || 0;
          const vatRate = line.vatRate || 15;

          // Get stock item for snapshot
          let itemSnapshot = {
            sku: "",
            name: line.description || "Unknown Item",
            unit: "each",
            vatRate: vatRate,
            isVatExempt: false,
          };

          if (line.stockItemId) {
            const stockItem = await StockItem.findById(line.stockItemId).lean();
            if (stockItem) {
              itemSnapshot = {
                sku: stockItem.sku || "",
                name: stockItem.name || line.description || "Unknown Item",
                unit: stockItem.unit || "each",
                vatRate: stockItem.tax?.vatRate || vatRate,
                isVatExempt: stockItem.tax?.isVatExempt || false,
              };
            }
          }

          // Calculate line amounts
          const lineSubtotal = unitCostCents * quantity;
          const vatAmount = itemSnapshot.isVatExempt
            ? 0
            : Math.round(lineSubtotal * (itemSnapshot.vatRate / 100));
          const lineTotal = lineSubtotal + vatAmount;

          subtotalCents += lineSubtotal;
          vatTotalCents += vatAmount;

          return {
            lineNo: index + 1,
            stockItemId: line.stockItemId,
            itemSnapshot,
            description: line.description || itemSnapshot.name,
            quantity,
            unitCostCents,
            vatRate: itemSnapshot.vatRate,
            vatCents: vatAmount,
            subtotalCents: lineTotal,
            grvId: line.grvId,
            poLineId: line.poLineId || null,
          };
        })
      );

      const totalCents = subtotalCents + vatTotalCents - discountCents;

      // Extract GRV IDs from lines
      const grvIds = [
        ...new Set(
          processedLines
            .map((line: any) => line.grvId)
            .filter(Boolean)
        ),
      ];

      body.billLines = processedLines;
      body.subtotalCents = subtotalCents;
      body.vatCents = vatTotalCents;
      body.totalCents = totalCents;
      body.grvIds = grvIds;
    }

    // Update the bill
    const bill = await SupplierBill.findOneAndUpdate(
      { _id: id, companyId: session.companyId, isDeleted: false },
      { ...body, updatedBy: session.userId },
      { new: true }
    )
      .populate("supplierId", "name email phone")
      .populate("poId", "poNumber");

    if (!bill) {
      return NextResponse.json({ error: "Supplier bill not found" }, { status: 404 });
    }

    return NextResponse.json({ data: bill });
  } catch (error: any) {
    console.error("Error updating supplier bill:", error);
    return NextResponse.json({ error: error.message || "Failed to update supplier bill" }, { status: 500 });
  }
}

// DELETE /api/supplier-bills/[id] - Soft delete a supplier bill (only Draft can be deleted)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bill = await SupplierBill.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!bill) {
      return NextResponse.json({ error: "Supplier bill not found" }, { status: 404 });
    }

    if (bill.status !== "Draft") {
      return NextResponse.json(
        { error: "Only Draft status bills can be deleted" },
        { status: 400 }
      );
    }

    await bill.softDelete(session.userId);

    return NextResponse.json({ message: "Supplier bill deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting supplier bill:", error);
    return NextResponse.json({ error: error.message || "Failed to delete supplier bill" }, { status: 500 });
  }
}

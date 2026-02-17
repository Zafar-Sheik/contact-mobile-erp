import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { GRV } from "@/lib/models/GRV";
import { Counter } from "@/lib/models/Counter";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/supplier-bills/create-from-grv - Create a supplier bill from one or more GRVs
export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate required fields
    if (!body.grvIds || !Array.isArray(body.grvIds) || body.grvIds.length === 0) {
      return NextResponse.json({ error: "At least one GRV is required" }, { status: 400 });
    }

    // Fetch all GRVs
    const grvs = await GRV.find({
      _id: { $in: body.grvIds },
      companyId: session.companyId,
      isDeleted: false,
    }).lean();

    if (grvs.length !== body.grvIds.length) {
      return NextResponse.json({ error: "One or more GRVs not found" }, { status: 404 });
    }

    // Validate all GRVs belong to same supplier
    const supplierId = grvs[0].supplierId?.toString();
    for (const grv of grvs) {
      if (grv.supplierId?.toString() !== supplierId) {
        return NextResponse.json(
          { error: "All GRVs must be from the same supplier" },
          { status: 400 }
        );
      }
    }

    // Validate all GRVs are Posted status
    for (const grv of grvs) {
      if (grv.status !== "Posted") {
        return NextResponse.json(
          { error: `GRV ${grv.grvNumber} is not in Posted status` },
          { status: 400 }
        );
      }
    }

    // Validate GRVs don't already have a bill
    for (const grv of grvs) {
      // Check if this GRV is already linked to a bill
      const existingBill = await SupplierBill.findOne({
        grvIds: grv._id,
        status: { $nin: ["Voided"] },
        isDeleted: false,
      });

      if (existingBill) {
        return NextResponse.json(
          { error: `GRV ${grv.grvNumber} is already linked to bill ${existingBill.billNumber}` },
          { status: 400 }
        );
      }
    }

    // Generate bill number
    const counter = await Counter.findOneAndUpdate(
      { companyId: session.companyId, key: "SUPPLIER_BILL" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true }
    );
    const sequence = String(counter.nextNumber).padStart(5, "0");
    const billNumber = `BILL-${sequence}`;

    // Aggregate lines from all GRVs
    let lineIndex = 1;
    let subtotalCents = 0;
    let vatTotalCents = 0;
    const discountCents = 0; // No discount on create-from-grv

    const billLines = [];

    for (const grv of grvs) {
      for (const line of grv.lines || []) {
        const quantity = line.receivedQty || 0;
        const unitCostCents = line.unitCostCents || 0;
        const vatRate = line.itemSnapshot?.vatRate || 15;
        const isVatExempt = line.itemSnapshot?.isVatExempt || false;

        // Calculate line amounts
        const lineSubtotal = unitCostCents * quantity;
        const vatAmount = isVatExempt ? 0 : Math.round(lineSubtotal * (vatRate / 100));
        const lineTotal = lineSubtotal + vatAmount;

        subtotalCents += lineSubtotal;
        vatTotalCents += vatAmount;

        billLines.push({
          lineNo: lineIndex++,
          stockItemId: line.stockItemId,
          itemSnapshot: line.itemSnapshot || {
            sku: "",
            name: line.description || "Unknown Item",
            unit: "each",
            vatRate: vatRate,
            isVatExempt: isVatExempt,
          },
          description: line.description || line.itemSnapshot?.name || "Unknown Item",
          quantity,
          unitCostCents,
          vatRate,
          vatCents: vatAmount,
          subtotalCents: lineTotal,
          grvId: grv._id,
          poLineId: line.poLineId || null,
        });
      }
    }

    const totalCents = subtotalCents + vatTotalCents - discountCents;

    // Set default bill date to today
    const billDate = new Date();
    
    // Calculate due date (default to 30 days from bill date)
    let dueDate = null;
    if (body.dueDate) {
      dueDate = new Date(body.dueDate);
    } else {
      dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + 30);
    }

    const billData = {
      billNumber,
      supplierId: grvs[0].supplierId,
      poId: grvs[0].poId || null,
      grvIds: grvs.map((g) => g._id),
      billDate,
      dueDate,
      status: "Draft",
      reference: body.reference || "",
      subtotalCents,
      vatCents: vatTotalCents,
      discountCents,
      totalCents,
      paidCents: 0,
      notes: body.notes || "",
      billLines,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    };

    const bill = await SupplierBill.create(billData);

    // Populate for response
    await bill.populate("supplierId", "name email phone");
    await bill.populate("grvIds", "grvNumber");

    return NextResponse.json(
      {
        data: bill,
        message: `Supplier bill ${billNumber} created successfully from ${grvs.length} GRV(s)`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating supplier bill from GRV:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create supplier bill from GRV" },
      { status: 500 }
    );
  }
}

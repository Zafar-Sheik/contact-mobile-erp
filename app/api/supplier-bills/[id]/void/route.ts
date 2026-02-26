import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { GRV } from "@/lib/models/GRV";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/supplier-bills/[id]/void - Void a supplier bill (change status from Posted/PartiallyPaid to Voided)
export async function POST(
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

    // Find the bill
    const bill = await SupplierBill.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!bill) {
      return NextResponse.json({ error: "Supplier bill not found" }, { status: 404 });
    }

    // Check if bill can be voided (Posted or PartiallyPaid status)
    if (!["Posted", "PartiallyPaid"].includes(bill.status)) {
      return NextResponse.json(
        { error: "Only Posted or PartiallyPaid bills can be voided" },
        { status: 400 }
      );
    }

    // Check if bill has payments - cannot void if fully paid
    if (bill.paidCents > 0) {
      const paidPercentage = (bill.paidCents / bill.totalCents) * 100;
      if (paidPercentage >= 100) {
        return NextResponse.json(
          { error: "Cannot void a fully paid bill. Please process a credit note instead." },
          { status: 400 }
        );
      }
      // For partially paid bills, we allow voiding but note the partial payment
      console.log(`Voiding partially paid bill: ${bill.billNumber}, paid: ${bill.paidCents} of ${bill.totalCents}`);
    }

    // Update GRVs to unlink them from this bill
    // Note: GRVs remain Posted as they've already been received into inventory
    if (bill.grvIds && bill.grvIds.length > 0) {
      await GRV.updateMany(
        { _id: { $in: bill.grvIds }, supplierInvoiceId: bill._id },
        { $unset: { supplierInvoiceId: "" } }
      );
    }

    // Update bill status to Voided
    bill.status = "Voided";
    bill.voidedAt = new Date();
    bill.voidedBy = session.userId;
    if (body?.notes) {
      bill.notes = (bill.notes ? bill.notes + "\n" : "") + `Voided: ${body.notes}`;
    }
    await bill.save();

    return NextResponse.json({
      message: "Supplier bill voided successfully",
      data: bill,
    });
  } catch (error: any) {
    console.error("Error voiding supplier bill:", error);
    return NextResponse.json({ error: error.message || "Failed to void supplier bill" }, { status: 500 });
  }
}

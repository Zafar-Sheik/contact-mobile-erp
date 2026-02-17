import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { GRV } from "@/lib/models/GRV";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/supplier-bills/[id]/post - Post a supplier bill (change status from Draft to Posted)
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

    // Find the bill
    const bill = await SupplierBill.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!bill) {
      return NextResponse.json({ error: "Supplier bill not found" }, { status: 404 });
    }

    // Check if bill is in Draft status
    if (bill.status !== "Draft") {
      return NextResponse.json(
        { error: "Only Draft status bills can be posted" },
        { status: 400 }
      );
    }

    // Validate bill has supplier and lines
    if (!bill.supplierId) {
      return NextResponse.json({ error: "Bill must have a supplier" }, { status: 400 });
    }

    if (!bill.billLines || bill.billLines.length === 0) {
      return NextResponse.json(
        { error: "Bill must have at least one line item" },
        { status: 400 }
      );
    }

    // Update GRVs to mark them as billed
    if (bill.grvIds && bill.grvIds.length > 0) {
      await GRV.updateMany(
        { _id: { $in: bill.grvIds } },
        { 
          $set: { 
            supplierInvoiceId: bill._id,
            status: "Posted" // GRVs should already be posted, but ensure status
          } 
        }
      );
    }

    // Update bill status to Posted
    bill.status = "Posted";
    bill.postedAt = new Date();
    bill.postedBy = session.userId;
    await bill.save();

    return NextResponse.json({
      message: "Supplier bill posted successfully",
      data: bill,
    });
  } catch (error: any) {
    console.error("Error posting supplier bill:", error);
    return NextResponse.json({ error: error.message || "Failed to post supplier bill" }, { status: 500 });
  }
}

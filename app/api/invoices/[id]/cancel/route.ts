import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/invoices/[id]/cancel - Cancel an invoice
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

    const invoice = await SalesInvoice.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Check if already cancelled
    if (invoice.status === "cancelled") {
      return NextResponse.json(
        { error: "Invoice is already cancelled" },
        { status: 400 }
      );
    }

    // Only allow cancellation if not fully paid
    if (invoice.amountPaidCents >= invoice.totals.totalCents) {
      return NextResponse.json(
        { error: "Cannot cancel a fully paid invoice" },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const updatedInvoice = await SalesInvoice.findOneAndUpdate(
      { _id: id, companyId: session.companyId, isDeleted: false },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        updatedBy: session.userId,
      },
      { new: true }
    ).populate("clientId", "name email phone");

    return NextResponse.json({ 
      data: updatedInvoice,
      message: "Invoice cancelled successfully" 
    });
  } catch (error: any) {
    console.error("Error cancelling invoice:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel invoice" }, { status: 500 });
  }
}

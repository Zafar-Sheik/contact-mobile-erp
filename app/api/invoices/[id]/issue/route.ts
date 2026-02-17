import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/invoices/[id]/issue - Issue an invoice (change status from draft to issued)
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

    // Validate status
    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be issued" },
        { status: 400 }
      );
    }

    // Validate invoice has lines
    if (!invoice.lines || invoice.lines.length === 0) {
      return NextResponse.json(
        { error: "Invoice must have at least one line item" },
        { status: 400 }
      );
    }

    // Validate client exists
    if (!invoice.clientId) {
      return NextResponse.json(
        { error: "Invoice must have a client" },
        { status: 400 }
      );
    }

    // Update status to issued
    const updateData: any = {
      status: "issued",
      issuedAt: new Date(),
      updatedBy: session.userId,
    };

    // Set issueDate if not already set
    if (!invoice.issueDate) {
      updateData.issueDate = new Date();
    }

    // Update the invoice
    const updatedInvoice = await SalesInvoice.findOneAndUpdate(
      { _id: id, companyId: session.companyId, isDeleted: false },
      updateData,
      { new: true }
    ).populate("clientId", "name email phone");

    return NextResponse.json({ 
      data: updatedInvoice,
      message: "Invoice issued successfully" 
    });
  } catch (error: any) {
    console.error("Error issuing invoice:", error);
    return NextResponse.json({ error: error.message || "Failed to issue invoice" }, { status: 500 });
  }
}

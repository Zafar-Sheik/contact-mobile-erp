import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import { Client } from "@/lib/models/Client";
import { Counter } from "@/lib/models/Counter";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateBalanceDue } from "@/lib/utils/totals";

// GET /api/invoices/[id]/payments - Get all payments for this invoice
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

    // Verify invoice exists
    const invoice = await SalesInvoice.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get all payments for this invoice
    const payments = await CustomerPayment.find({
      companyId: session.companyId,
      isDeleted: false,
      "allocatedInvoices.invoiceId": id,
    })
      .select("-isDeleted -deletedAt")
      .populate("clientId", "name email")
      .sort({ paymentDate: -1 })
      .lean();

    return NextResponse.json({ data: payments });
  } catch (error: any) {
    console.error("Error fetching invoice payments:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payments" }, { status: 500 });
  }
}

// POST /api/invoices/[id]/payments - Record a payment against this invoice
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
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate required fields
    if (!body.amountCents || body.amountCents <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }

    if (!body.paymentDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    if (!body.paymentMethod) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    // Verify invoice exists
    const invoice = await SalesInvoice.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow payments on issued, partially_paid, or paid invoices
    if (!["issued", "partially_paid", "paid"].includes(invoice.status)) {
      return NextResponse.json(
        { error: "Payments can only be recorded on issued or partially paid invoices" },
        { status: 400 }
      );
    }

    // Get client for payment
    const client = await Client.findById(invoice.clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create client snapshot
    const clientSnapshot = {
      name: client.name,
      email: client.email || "",
    };

    // Generate payment number
    const counter = await Counter.findOneAndUpdate(
      { companyId: session.companyId, key: "PAY" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true }
    );
    const sequence = String(counter.nextNumber).padStart(5, "0");
    const paymentNumber = `PAY-${sequence}`;

    // Calculate new amounts
    const paymentAmount = body.amountCents;
    const newAmountPaid = invoice.amountPaidCents + paymentAmount;
    const newBalanceDue = calculateBalanceDue(invoice.totals.totalCents, newAmountPaid);

    // Determine new status
    let newStatus: string;
    if (newBalanceDue <= 0) {
      newStatus = "paid";
    } else {
      newStatus = "partially_paid";
    }

    // Create the payment
    const payment = await CustomerPayment.create({
      paymentNumber,
      clientId: client._id,
      clientSnapshot,
      amountCents: paymentAmount,
      paymentDate: new Date(body.paymentDate),
      paymentMethod: body.paymentMethod,
      reference: body.reference || "",
      allocatedInvoices: [{
        invoiceId: invoice._id,
        amountCents: paymentAmount,
        allocatedAt: new Date(),
      }],
      unallocatedCents: 0,
      status: "posted",
      postedAt: new Date(),
      notes: body.notes || "",
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    // Update invoice with new amounts and status
    const updateData: any = {
      amountPaidCents: newAmountPaid,
      balanceDueCents: newBalanceDue,
      updatedBy: session.userId,
    };

    // Set paidAt if fully paid
    if (newStatus === "paid" && invoice.status !== "paid") {
      updateData.status = "paid";
      updateData.paidAt = new Date();
    } else if (newStatus === "partially_paid" && invoice.status === "issued") {
      updateData.status = "partially_paid";
    }

    const updatedInvoice = await SalesInvoice.findOneAndUpdate(
      { _id: id, companyId: session.companyId, isDeleted: false },
      updateData,
      { new: true }
    ).populate("clientId", "name email phone");

    // Populate payment for response
    await payment.populate("clientId", "name email");

    return NextResponse.json({ 
      data: {
        payment,
        invoice: updatedInvoice,
      },
      message: "Payment recorded successfully" 
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return NextResponse.json({ error: error.message || "Failed to record payment" }, { status: 500 });
  }
}

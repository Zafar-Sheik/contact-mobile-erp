import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { Client } from "@/lib/models/Client";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateBalanceDue } from "@/lib/utils/totals";

// GET /api/bills/[id] - Get a specific debtor payment
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

    const payment = await (CustomerPayment.findOne as any)({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    })
      .populate("clientId", "name email phone clientCode")
      .lean();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ data: payment });
  } catch (error: any) {
    console.error("Error fetching customer payment:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payment" }, { status: 500 });
  }
}

// PUT /api/bills/[id] - Update a debtor payment (limited operations)
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

    const payment = await (CustomerPayment.findOne as any)({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Only allow updates to certain fields
    const allowedUpdates = {
      reference: body.reference,
      notes: body.notes,
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key as keyof typeof allowedUpdates] === undefined) {
        delete allowedUpdates[key as keyof typeof allowedUpdates];
      }
    });

    const updatedPayment = await (CustomerPayment.findOneAndUpdate as any)(
      { _id: id, companyId: session.companyId },
      { ...allowedUpdates, updatedBy: session.userId },
      { new: true }
    ).populate("clientId", "name email");

    return NextResponse.json({ data: updatedPayment });
  } catch (error: any) {
    console.error("Error updating customer payment:", error);
    return NextResponse.json({ error: error.message || "Failed to update payment" }, { status: 500 });
  }
}

// DELETE /api/bills/[id] - Reverse a debtor payment
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

    const payment = await (CustomerPayment.findOne as any)({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "reversed") {
      return NextResponse.json({ error: "Payment is already reversed" }, { status: 400 });
    }

    // Reverse allocations - restore invoice balances
    for (const allocation of payment.allocatedInvoices) {
      const invoice = await SalesInvoice.findById(allocation.invoiceId);
      if (invoice) {
        const newAmountPaid = invoice.amountPaidCents - allocation.amountCents;
        const newBalanceDue = calculateBalanceDue(invoice.totals.totalCents, newAmountPaid);

        // Determine new status
        let newStatus: string;
        if (newBalanceDue <= 0) {
          newStatus = "paid";
        } else if (newAmountPaid > 0) {
          newStatus = "partially_paid";
        } else {
          newStatus = "issued";
        }

        await SalesInvoice.findOneAndUpdate(
          { _id: invoice._id },
          {
            amountPaidCents: newAmountPaid,
            balanceDueCents: newBalanceDue,
            status: newStatus,
            updatedBy: session.userId,
          }
        );
      }
    }

    // Restore payment amount to client's unallocated funds
    await Client.findByIdAndUpdate(payment.clientId, {
      $inc: { unallocatedCents: payment.amountCents },
      updatedBy: session.userId,
    });

    // Reverse the payment
    const reversedPayment = await (CustomerPayment.findOneAndUpdate as any)(
      { _id: id, companyId: session.companyId },
      {
        status: "reversed",
        reversedAt: new Date(),
        updatedBy: session.userId,
      },
      { new: true }
    );

    return NextResponse.json({
      data: reversedPayment,
      message: "Payment reversed successfully"
    });
  } catch (error: any) {
    console.error("Error reversing customer payment:", error);
    return NextResponse.json({ error: error.message || "Failed to reverse payment" }, { status: 500 });
  }
}
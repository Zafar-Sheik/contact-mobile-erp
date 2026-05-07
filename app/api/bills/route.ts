import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { Client } from "@/lib/models/Client";
import { Counter } from "@/lib/models/Counter";
import { getSessionClaims } from "@/lib/auth/session";
import mongoose from "mongoose";

// GET /api/bills - Get all debtor payments
export async function GET(
  req: Request
) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = url.searchParams.get("limit");
    const clientId = url.searchParams.get("clientId");

    const query: any = {
      companyId: session.companyId,
      isDeleted: false,
    };

    if (clientId) {
      query.clientId = clientId;
    }

    // Get payments with client info
    const payments = await CustomerPayment.find(query)
      .populate("clientId", "name email phone clientCode balanceCents unallocatedCents")
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(limit ? parseInt(limit) : 0)
      .lean();

    // Calculate actual outstanding balance for each client from invoices
    const clientIds = [...new Set(payments.map(p => {
      const id = typeof p.clientId === 'object' && p.clientId ? p.clientId._id?.toString() : null;
      console.log(`Payment clientId:`, p.clientId, `extracted id:`, id);
      return id;
    }).filter(Boolean))];
    const outstandingBalances = new Map();

    if (clientIds.length > 0) {
      // Calculate outstanding balance for each client
      // Total Owing = SUM(all invoice totals) - SUM(all payments received)
      for (const clientId of clientIds) {
        // Get total of all invoices for this client (issued, partially_paid, paid, overdue)
        const invoices = await SalesInvoice.find({
          clientId: new mongoose.Types.ObjectId(clientId),
          companyId: new mongoose.Types.ObjectId(session.companyId),
          isDeleted: false,
          status: { $in: ["issued", "partially_paid", "paid", "overdue"] }
        }).select('totals.totalCents').lean();

        const totalInvoiced = invoices.reduce((sum, invoice) =>
          sum + (invoice.totals?.totalCents || 0), 0);

        // Get total payments received by this client
        const paymentsReceived = await CustomerPayment.find({
          clientId: new mongoose.Types.ObjectId(clientId),
          companyId: new mongoose.Types.ObjectId(session.companyId),
          isDeleted: false,
          status: "posted"
        }).select('amountCents').lean();

        const totalPaid = paymentsReceived.reduce((sum, payment) =>
          sum + (payment.amountCents || 0), 0);

        // Client owes = total invoiced - total paid (can be negative for credits)
        const clientOwes = totalInvoiced - totalPaid;

        console.log(`Client ${clientId}: total invoiced ${totalInvoiced}, total paid ${totalPaid}, client owes ${clientOwes}`);
        outstandingBalances.set(clientId, clientOwes);
      }
    }

    // Add calculated outstanding balance to payments
    const paymentsWithBalances = payments.map(payment => {
      let balance = 0;
      if (typeof payment.clientId === 'object' && payment.clientId) {
        const clientId = payment.clientId._id?.toString();
        balance = outstandingBalances.get(clientId) || 0;
        console.log(`Client ${clientId}: calculated balance ${balance}`);
      }

      // Balance is 0 if no outstanding invoices found

      return {
        ...payment,
        clientId: typeof payment.clientId === 'object' && payment.clientId
          ? {
              ...payment.clientId,
              calculatedOutstandingBalance: balance
            }
          : payment.clientId
      };
    });

    return NextResponse.json({ data: paymentsWithBalances });
  } catch (error: any) {
    console.error("Error fetching customer payments:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch payments" }, { status: 500 });
  }
}

// POST /api/bills - Record a new debtor payment with FIFO reconciliation
export async function POST(
  req: Request
) {
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
    if (!body.clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    if (!body.amountCents || body.amountCents <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }

    if (!body.paymentDate) {
      return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
    }

    if (!body.paymentMethod) {
      return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
    }

    // Get client for payment
    const client = await Client.findById(body.clientId);
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

    // Get outstanding invoices for this client (FIFO: oldest first)
    const outstandingInvoices = await SalesInvoice.find({
      clientId: body.clientId,
      companyId: session.companyId,
      isDeleted: false,
      status: { $in: ["issued", "partially_paid"] },
      balanceDueCents: { $gt: 0 },
    })
      .sort({ issueDate: 1 }) // Oldest first (FIFO)
      .lean();

    // Implement FIFO reconciliation with client-level unallocated funds
    // Add new payment to existing unallocated funds for total available amount
    const totalAvailableFunds = (client.unallocatedCents || 0) + body.amountCents;
    let remainingAmount = totalAvailableFunds;
    const allocations: Array<{
      invoiceId: string;
      amountCents: number;
      allocatedAt: Date;
    }> = [];
    const reconciliationDetails: Array<{
      invoiceId: string;
      invoiceNumber: string;
      allocatedAmount: number;
      remainingBalance: number;
    }> = [];

    for (const invoice of outstandingInvoices) {
      if (remainingAmount <= 0) break;

      const amountToAllocate = Math.min(remainingAmount, invoice.balanceDueCents);
      const newBalanceDue = invoice.balanceDueCents - amountToAllocate;

      // Record allocation
      allocations.push({
        invoiceId: invoice._id.toString(),
        amountCents: amountToAllocate,
        allocatedAt: new Date(),
      });

      reconciliationDetails.push({
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        allocatedAmount: amountToAllocate,
        remainingBalance: newBalanceDue,
      });

      // Update invoice status and amounts
      let newStatus: string;
      if (newBalanceDue <= 0) {
        newStatus = "paid";
      } else {
        newStatus = "partially_paid";
      }

      const updateData: any = {
        amountPaidCents: invoice.amountPaidCents + amountToAllocate,
        balanceDueCents: newBalanceDue,
        updatedBy: session.userId,
      };

      if (newStatus !== invoice.status) {
        updateData.status = newStatus;
        if (newStatus === "paid" && invoice.status !== "paid") {
          updateData.paidAt = new Date();
        }
      }

      await SalesInvoice.findOneAndUpdate(
        { _id: invoice._id, companyId: session.companyId },
        updateData,
        { new: true }
      );

      remainingAmount -= amountToAllocate;
    }

    const newUnallocatedCents = remainingAmount;

    // Update client's unallocated funds
    await Client.findByIdAndUpdate(client._id, {
      unallocatedCents: newUnallocatedCents,
      updatedBy: session.userId,
    });

    // Create the payment record (only tracks newly added amount)
    const payment = await CustomerPayment.create({
      paymentNumber,
      clientId: client._id,
      clientSnapshot,
      amountCents: body.amountCents, // New payment amount only
      paymentDate: new Date(body.paymentDate),
      paymentMethod: body.paymentMethod,
      reference: body.reference || "",
      allocatedInvoices: allocations,
      unallocatedCents: 0, // Payment-level unallocated is now 0, client holds the unallocated funds
      status: "posted",
      postedAt: new Date(),
      notes: body.notes || "",
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    // Populate payment for response
    await payment.populate("clientId", "name email");

    const totalAllocatedFromPayment = totalAvailableFunds - newUnallocatedCents;
    const reconciliationResult = {
      payment,
      allocations: reconciliationDetails,
      totalAllocated: totalAllocatedFromPayment,
      unallocatedAmount: newUnallocatedCents,
    };

    return NextResponse.json({
      data: reconciliationResult,
      message: "Payment recorded and reconciled successfully"
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error recording customer payment:", error);
    return NextResponse.json({ error: error.message || "Failed to record payment" }, { status: 500 });
  }
}
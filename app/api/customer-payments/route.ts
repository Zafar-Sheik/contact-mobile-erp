import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionClaims } from "@/lib/auth/session";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import {
  postCustomerPayment,
  voidCustomerPayment,
  autoAllocateCustomerPayment,
  getPayInvoicesUIData,
  getCustomerPaymentWithAllocations,
  calculateClientBalance,
} from "@/lib/services/customer-payment-service";

// GET /api/customer-payments - Get customer payments with optional filters
export async function GET(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Build query
    const query: any = {
      companyId: session.companyId,
      isDeleted: false,
    };

    if (clientId) query.clientId = clientId;
    if (status) query.status = status;
    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    const payments = await CustomerPayment.find(query)
      .populate("clientId", "name email")
      .sort({ paymentDate: -1 })
      .lean();

    // Calculate totals for each payment
    const paymentsWithTotals = payments.map((payment: any) => ({
      ...payment,
      allocatedCents: (payment.allocatedInvoices || []).reduce(
        (sum: number, alloc: any) => sum + (alloc.amountCents || 0),
        0
      ),
    }));

    return NextResponse.json({ data: paymentsWithTotals });
  } catch (error: any) {
    console.error("Error fetching customer payments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// POST /api/customer-payments - Create a new customer payment
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

    // Prepare payment data
    const paymentData = {
      clientId: body.clientId,
      amountCents: body.amountCents,
      paymentDate: new Date(body.paymentDate),
      paymentMethod: body.paymentMethod,
      reference: body.reference || "",
      notes: body.notes || "",
      allocations: body.allocations || [],
    };

    // If no manual allocations, auto-allocate
    if (!body.allocations || body.allocations.length === 0) {
      paymentData.allocations = await autoAllocateCustomerPayment(
        body.clientId,
        body.amountCents
      );
    }

    // Post the payment
    const result = await postCustomerPayment(
      paymentData,
      session.userId,
      session.role || "user"
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors.join(", "), warnings: result.warnings },
        { status: 400 }
      );
    }

    // Get the created payment with allocations
    const paymentWithAllocations = await getCustomerPaymentWithAllocations(
      result.paymentId.toString()
    );

    return NextResponse.json({
      data: paymentWithAllocations,
      message: "Payment recorded successfully",
      warnings: result.warnings,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
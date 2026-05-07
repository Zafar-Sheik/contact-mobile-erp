import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionClaims } from "@/lib/auth/session";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import {
  voidCustomerPayment,
  getCustomerPaymentWithAllocations,
} from "@/lib/services/customer-payment-service";

// GET /api/customer-payments/[id] - Get specific payment
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

    const payment = await getCustomerPaymentWithAllocations(id);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Check if payment belongs to user's company
    const paymentDoc = await CustomerPayment.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!paymentDoc) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ data: payment });
  } catch (error: any) {
    console.error("Error fetching customer payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch payment" },
      { status: 500 }
    );
  }
}

// PUT /api/customer-payments/[id] - Update payment (mainly for voiding)
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

    // Verify payment exists and belongs to company
    const payment = await CustomerPayment.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Handle voiding
    if (body.action === "void") {
      if (!body.reason) {
        return NextResponse.json({ error: "Reason is required for voiding" }, { status: 400 });
      }

      const result = await voidCustomerPayment(
        id,
        session.userId,
        session.role || "user",
        body.reason
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.errors.join(", ") },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: "Payment voided successfully",
        data: result,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error updating customer payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update payment" },
      { status: 500 }
    );
  }
}

// DELETE /api/customer-payments/[id] - Soft delete payment (if allowed)
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

    // Only allow deletion of draft payments
    const payment = await CustomerPayment.findOne({
      _id: id,
      companyId: session.companyId,
      status: "draft",
      isDeleted: false,
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found or cannot be deleted" },
        { status: 404 }
      );
    }

    // Soft delete
    await CustomerPayment.updateOne(
      { _id: id },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: session.userId,
        },
      }
    );

    return NextResponse.json({ message: "Payment deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting customer payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete payment" },
      { status: 500 }
    );
  }
}
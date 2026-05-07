import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Client } from "@/lib/models/Client";
import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { SalesQuote } from "@/lib/models/SalesQuote";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Any authenticated user can view client
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const client = await Client.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Get outstanding invoices for this client
  const outstandingInvoices = await SalesInvoice.find({
    clientId: id,
    companyId: session.companyId,
    isDeleted: false,
    status: { $in: ["issued", "partially_paid", "overdue"] } // Only include invoices that are not fully paid
  })
    .select("invoiceNumber status issueDate dueDate totals totalCents amountPaidCents balanceDueCents")
    .sort({ issueDate: -1 })
    .lean();

  // Calculate totals from actual invoice data
  const totalOutstanding = outstandingInvoices.reduce((sum, invoice) => sum + (invoice.balanceDueCents || 0), 0);
  const totalOverdue = outstandingInvoices.reduce((sum, invoice) => {
    const isOverdue = new Date(invoice.dueDate) < new Date() &&
                      invoice.status !== "paid" &&
                      invoice.status !== "cancelled" &&
                      invoice.status !== "draft";
    return sum + (isOverdue ? (invoice.balanceDueCents || 0) : 0);
  }, 0);

  // Calculate actual balance from invoices (ignore stored balanceCents to prevent discrepancies)
  const calculatedBalanceCents = totalOutstanding;

  return NextResponse.json({
    data: {
      ...client,
      // Override the stored balanceCents with calculated value to ensure accuracy
      balanceCents: calculatedBalanceCents,
      outstandingInvoices: outstandingInvoices.map(invoice => ({
        ...invoice,
        // Convert cents to display amounts
        total: invoice.totalCents / 100,
        amountPaid: invoice.amountPaidCents / 100,
        balanceDue: invoice.balanceDueCents / 100
      })),
      summary: {
        totalOutstanding: totalOutstanding / 100,
        totalOverdue: totalOverdue / 100,
        invoiceCount: outstandingInvoices.length
      }
    }
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Admin, manager, worker, owner can update
  const session = await requireRole(["admin", "manager", "worker", "owner"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Prevent clientCode from being changed (it's auto-generated)
  const { clientCode: _, ...updateData } = body;

  const client = await Client.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...updateData, updatedBy: session.userId },
    { new: true }
  );

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Only admin, owner can delete
  const session = await requireRole(["admin", "owner"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const client = await Client.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Check for related records that would prevent deletion
  const [invoiceCount, quoteCount] = await Promise.all([
    SalesInvoice.countDocuments({ clientId: id, companyId: session.companyId, isDeleted: false }),
    SalesQuote.countDocuments({ clientId: id, companyId: session.companyId, isDeleted: false }),
  ]);

  if (invoiceCount > 0 || quoteCount > 0) {
    return NextResponse.json({
      error: "Cannot delete client with existing transactions. Client has related invoices, quotes, or payments."
    }, { status: 400 });
  }

  await client.softDelete(session.userId);

  return NextResponse.json({ message: "Client deleted successfully" });
}

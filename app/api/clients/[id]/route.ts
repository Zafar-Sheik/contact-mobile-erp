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

  return NextResponse.json({ data: client });
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

  // Process emails array if provided
  let processedEmails = undefined;
  if (body.emails !== undefined) {
    if (Array.isArray(body.emails)) {
      processedEmails = body.emails.map((email: any) => ({
        address: email.address?.trim().toLowerCase() || '',
        type: email.type || 'primary',
        label: email.label?.trim() || '',
        isPrimary: email.isPrimary || false,
      })).filter((email: any) => email.address); // Filter out empty emails

      // Ensure at least one email is primary if emails exist
      if (processedEmails.length > 0 && !processedEmails.some((e: any) => e.isPrimary)) {
        processedEmails[0].isPrimary = true;
      }
    } else {
      // If emails is set to null/empty, clear all emails
      processedEmails = [];
    }
  }

  // Prevent clientCode from being changed (it's auto-generated)
  const { clientCode: _, emails: __, ...updateData } = body;

  // Add processed emails to update data
  if (processedEmails !== undefined) {
    updateData.emails = processedEmails;
  }

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

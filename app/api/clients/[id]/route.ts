import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Client } from "@/lib/models/Client";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

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
  
  // Admin, manager, worker can update
  const session = await requireRole(["admin", "manager", "worker"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const client = await Client.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
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
  
  // Only admin can delete
  const session = await requireRole(["admin"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const client = await Client.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await client.softDelete(session.userId);

  return NextResponse.json({ message: "Client deleted successfully" });
}

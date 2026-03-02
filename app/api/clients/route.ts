import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Client } from "@/lib/models/Client";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

export async function GET() {
  // Any authenticated user can view clients
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const clients = await Client.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: clients });
}

export async function POST(req: Request) {
  // Only admin, manager, worker can create clients
  const session = await requireRole(["admin", "manager", "worker"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const client = await Client.create({
    ...body,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  return NextResponse.json({ ok: true, data: client }, { status: 201 });
}

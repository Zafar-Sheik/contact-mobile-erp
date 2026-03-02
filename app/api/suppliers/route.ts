import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Supplier } from "@/lib/models/Supplier";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

export async function GET() {
  // Any authenticated user can view suppliers
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const suppliers = await Supplier.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ data: suppliers });
}

export async function POST(req: Request) {
  // Only admin, manager, worker can create suppliers
  const session = await requireRole(["admin", "manager", "worker"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const supplier = await Supplier.create({
    ...body,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  return NextResponse.json({ data: supplier }, { status: 201 });
}

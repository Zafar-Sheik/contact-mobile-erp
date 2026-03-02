import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Supplier } from "@/lib/models/Supplier";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Any authenticated user can view supplier
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const supplier = await Supplier.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  return NextResponse.json({ data: supplier });
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

  const supplier = await Supplier.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  return NextResponse.json({ data: supplier });
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

  const supplier = await Supplier.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  await supplier.softDelete(session.userId);

  return NextResponse.json({ message: "Supplier deleted successfully" });
}

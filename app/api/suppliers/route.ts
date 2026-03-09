import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Supplier } from "@/lib/models/Supplier";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Any authenticated user can view suppliers
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    await dbConnect();

    const suppliers = await Supplier.find({ companyId: session.companyId, isDeleted: false })
      .select("-isDeleted -deletedAt")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ data: suppliers });
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Only admin, manager, worker, owner can create suppliers
  const session = await requireRole(["admin", "manager", "worker", "owner"]);
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

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payment = await SupplierPayment.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .lean();

  if (!payment) {
    return NextResponse.json({ error: "Supplier payment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: payment });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const payment = await SupplierPayment.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!payment) {
    return NextResponse.json({ error: "Supplier payment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: payment });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payment = await SupplierPayment.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!payment) {
    return NextResponse.json({ error: "Supplier payment not found" }, { status: 404 });
  }

  await payment.softDelete(session.userId);

  return NextResponse.json({ message: "Supplier payment deleted successfully" });
}

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await PurchaseOrder.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!order) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  return NextResponse.json({ data: order });
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

  // Transform frontend data to match model
  const statusMap: Record<string, string> = {
    pending: "Draft",
    approved: "Issued",
    received: "FullyReceived",
    cancelled: "Cancelled",
  };

  const updateData: Record<string, unknown> = {
    ...(body.supplierId !== undefined && { supplierId: body.supplierId }),
    ...(body.poNumber && { poNumber: body.poNumber }),
    ...(body.status && { status: statusMap[body.status] || body.status }),
    ...(body.expectedDelivery && { expectedAt: body.expectedDelivery }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.total && { subtotalCents: body.total }),
    updatedBy: session.userId,
  };

  const order = await PurchaseOrder.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    updateData,
    { new: true }
  ).populate("supplierId", "name email phone");

  if (!order) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  // Transform to match frontend expected format
  const transformedOrder = {
    _id: order._id,
    poNumber: order.poNumber,
    supplierId: (order.supplierId as any)?._id || order.supplierId,
    supplierName: (order.supplierId as any)?.name || "",
    date: order.createdAt,
    expectedDelivery: order.expectedAt,
    total: order.subtotalCents,
    status: order.status,
    notes: order.notes,
    isActive: !order.isDeleted,
  };

  return NextResponse.json({ data: transformedOrder });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await PurchaseOrder.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!order) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  await order.softDelete(session.userId);

  return NextResponse.json({ message: "Purchase order deleted successfully" });
}

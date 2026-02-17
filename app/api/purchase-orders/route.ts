import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { Supplier } from "@/lib/models/Supplier";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await PurchaseOrder.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .sort({ createdAt: -1 })
    .lean();

  // Transform to match frontend expected format
  const transformedOrders = orders.map((order: any) => ({
    _id: order._id,
    poNumber: order.poNumber,
    supplierId: order.supplierId?._id || order.supplierId,
    supplierName: order.supplierId?.name || "",
    date: order.createdAt,
    expectedDelivery: order.expectedAt,
    total: order.subtotalCents,
    status: order.status,
    notes: order.notes,
    isActive: !order.isDeleted,
  }));

  return NextResponse.json({ data: transformedOrders });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Validate supplierId is provided
  if (!body.supplierId) {
    return NextResponse.json({ error: "Supplier is required. Please select a supplier." }, { status: 400 });
  }

  // Transform frontend data to match model
  const statusMap: Record<string, string> = {
    pending: "Draft",
    approved: "Issued",
    received: "FullyReceived",
    cancelled: "Cancelled",
  };

  const order = await PurchaseOrder.create({
    supplierId: body.supplierId,
    poNumber: body.poNumber || `PO-${Date.now()}`,
    status: statusMap[body.status] || body.status || "Draft",
    expectedAt: body.expectedDelivery || body.expectedAt || null,
    notes: body.notes || "",
    subtotalCents: body.subtotalCents || body.total * 100 || 0,
    lines: body.lines || [],
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  }).then(doc => doc.populate("supplierId", "name email phone"));

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
    isActive: true,
  };

  return NextResponse.json({ data: transformedOrder }, { status: 201 });
}

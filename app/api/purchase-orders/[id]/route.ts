import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { getSessionClaims } from "@/lib/auth/session";

interface POLineProgress {
  lineNo: number;
  stockItemId: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  remainingQty: number;
}

interface POPResponse {
  _id: string;
  poNumber: string;
  supplierId: string | { _id: string; name: string; email?: string; phone?: string };
  supplierName?: string;
  date: string;
  expectedDelivery: string;
  total: number;
  status: string;
  notes?: string;
  lines: POLineProgress[];
  grvCount: number;
  billCount: number;
  isActive: boolean;
}

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

  // Fetch GRVs linked to this PO to calculate received qty
  const grvs = await GRV.find({
    poId: id,
    companyId: session.companyId,
    status: { $ne: "CANCELLED" },
    isDeleted: false,
  }).lean();

  // Fetch Supplier Bills linked to this PO to calculate billed qty
  const bills = await SupplierBill.find({
    poId: id,
    companyId: session.companyId,
    status: { $ne: "VOIDED" },
    isDeleted: false,
  }).lean();

  // Build a map of stockItemId -> { receivedQty, billedQty }
  const lineProgressMap = new Map<string, { receivedQty: number; billedQty: number }>();

  // Aggregate received qty from GRVs
  grvs.forEach((grv) => {
    grv.lines?.forEach((line: any) => {
      const stockItemId = line.stockItemId?.toString();
      if (stockItemId) {
        const existing = lineProgressMap.get(stockItemId) || { receivedQty: 0, billedQty: 0 };
        existing.receivedQty += line.receivedQty || 0;
        lineProgressMap.set(stockItemId, existing);
      }
    });
  });

  // Aggregate billed qty from Supplier Bills
  bills.forEach((bill) => {
    bill.billLines?.forEach((line: any) => {
      const stockItemId = line.stockItemId?.toString();
      if (stockItemId) {
        const existing = lineProgressMap.get(stockItemId) || { receivedQty: 0, billedQty: 0 };
        existing.billedQty += line.quantity || 0;
        lineProgressMap.set(stockItemId, existing);
      }
    });
  });

  // Transform lines with progress
  // First populate stock items to get name and sku
  const stockItemIds = (order.lines || []).map((line: any) => line.stockItemId).filter(Boolean);
  const { StockItem } = await import("@/lib/models/StockItem");
  const stockItems = await StockItem.find({ _id: { $in: stockItemIds } }).select("_id name sku unit").lean();
  const stockItemMap = new Map(stockItems.map((s: any) => [s._id.toString(), s]));
  
  const linesWithProgress: POLineProgress[] = (order.lines || []).map((line: any) => {
    const stockItemId = line.stockItemId?.toString();
    const stockItem = stockItemMap.get(stockItemId);
    const progress = lineProgressMap.get(stockItemId) || { receivedQty: 0, billedQty: 0 };
    return {
      lineNo: line.lineNo,
      stockItemId: stockItemId || "",
      description: line.description || "",
      orderedQty: line.orderedQty || 0,
      receivedQty: progress.receivedQty,
      billedQty: progress.billedQty,
      remainingQty: Math.max(0, (line.orderedQty || 0) - progress.receivedQty),
      unitCostCents: line.unitCostCents || 0,
      // Include stock item details for GRV creation
      stockItemName: stockItem?.name || "",
      stockItemSku: stockItem?.sku || "",
      stockItemUnit: stockItem?.unit || "each",
    };
  });

  const response: POPResponse = {
    _id: order._id.toString(),
    poNumber: order.poNumber,
    supplierId: typeof order.supplierId === 'object' ? order.supplierId : order.supplierId,
    supplierName: typeof order.supplierId === 'object' ? (order.supplierId as any)?.name : "",
    date: order.createdAt?.toString() || "",
    expectedDelivery: order.expectedAt?.toString() || "",
    total: order.subtotalCents || 0,
    status: order.status || "DRAFT",
    notes: order.notes || "",
    lines: linesWithProgress,
    grvCount: grvs.length,
    billCount: bills.length,
    isActive: !order.isDeleted,
  };

  return NextResponse.json({ data: response });
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
    draft: "DRAFT",
    submitted: "SUBMITTED",
    approved: "APPROVED",
    sent: "SENT",
    partiallyreceived: "PARTIALLY_RECEIVED",
    fullyreceived: "FULLY_RECEIVED",
    closed: "CLOSED",
    cancelled: "CANCELLED",
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

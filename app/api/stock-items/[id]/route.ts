import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await StockItem.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!item) {
    return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: item });
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

  // Check if SKU already exists for this company (excluding current item)
  if (body.sku) {
    const existingItem = await StockItem.findOne({
      companyId: session.companyId,
      sku: body.sku,
      _id: { $ne: id },
      isDeleted: false,
    });

    if (existingItem) {
      return NextResponse.json(
        { error: `A stock item with SKU "${body.sku}" already exists. Please use a different SKU.` },
        { status: 400 }
      );
    }
  }

  const item = await StockItem.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!item) {
    return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: item });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await StockItem.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!item) {
    return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
  }

  await item.softDelete(session.userId);

  return NextResponse.json({ message: "Stock item deleted successfully" });
}

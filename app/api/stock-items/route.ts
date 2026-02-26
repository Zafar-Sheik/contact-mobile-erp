import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await StockItem.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ data: items });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Check if SKU already exists for this company
  const existingItem = await StockItem.findOne({
    companyId: session.companyId,
    sku: body.sku,
    isDeleted: false,
  });

  if (existingItem) {
    return NextResponse.json(
      { error: `A stock item with SKU "${body.sku}" already exists. Please use a different SKU or edit the existing item.` },
      { status: 400 }
    );
  }

  try {
    const item = await StockItem.create({
      ...body,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { error: `A stock item with SKU "${body.sku}" already exists.` },
        { status: 400 }
      );
    }
    throw error;
  }
}

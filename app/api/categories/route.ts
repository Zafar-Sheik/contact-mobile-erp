import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ProductCategory } from "@/lib/models/ProductCategory";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await ProductCategory.find({
    companyId: session.companyId,
    isDeleted: false,
  })
    .select("-isDeleted -deletedAt")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ data: categories });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, description, parentCategoryId, isActive } = body as {
    name?: string;
    description?: string;
    parentCategoryId?: string;
    isActive?: boolean;
  };

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Check for duplicate name in same company
  const existing = await ProductCategory.findOne({
    companyId: session.companyId,
    name: name.trim(),
    isDeleted: false,
  });

  if (existing) {
    return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
  }

  const category = await ProductCategory.create({
    name: name.trim(),
    description: description?.trim() || "",
    parentCategoryId: parentCategoryId || null,
    isActive: isActive !== false,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  return NextResponse.json({ data: category }, { status: 201 });
}

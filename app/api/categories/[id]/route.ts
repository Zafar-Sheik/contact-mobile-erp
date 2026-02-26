import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ProductCategory } from "@/lib/models/ProductCategory";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const category = await ProductCategory.findOne({
    _id: id,
    companyId: session.companyId,
    isDeleted: false,
  })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data: category });
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

  const { name, description, parentCategoryId, isActive } = body as {
    name?: string;
    description?: string;
    parentCategoryId?: string;
    isActive?: boolean;
  };

  // Check for duplicate name if name is being updated
  if (name?.trim()) {
    const existing = await ProductCategory.findOne({
      companyId: session.companyId,
      name: name.trim(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existing) {
      return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
    }
  }

  const category = await ProductCategory.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    {
      name: name?.trim(),
      description: description?.trim(),
      parentCategoryId: parentCategoryId || null,
      isActive,
      updatedBy: session.userId,
    },
    { new: true }
  );

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({ data: category });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const category = await ProductCategory.findOne({
    _id: id,
    companyId: session.companyId,
    isDeleted: false,
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await category.softDelete(session.userId);

  return NextResponse.json({ message: "Category deleted successfully" });
}

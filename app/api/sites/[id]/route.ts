import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Site } from "@/lib/models/Site";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const site = await Site.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ data: site });
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

  // Check for duplicate code within company (excluding current site)
  if (body.code) {
    const existingCode = await Site.findOne({
      companyId: session.companyId,
      code: body.code,
      isDeleted: false,
      _id: { $ne: id },
    });
    if (existingCode) {
      return NextResponse.json({ error: "Site code already exists" }, { status: 400 });
    }
  }

  const site = await Site.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ data: site });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const site = await Site.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  await site.softDelete(session.userId);

  return NextResponse.json({ message: "Site deleted successfully" });
}

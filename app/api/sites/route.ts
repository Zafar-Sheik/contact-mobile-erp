import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Site } from "@/lib/models/Site";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sites = await Site.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ data: sites });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Check for duplicate code within company
  const existingCode = await Site.findOne({
    companyId: session.companyId,
    code: body.code,
    isDeleted: false,
  });
  if (existingCode) {
    return NextResponse.json({ error: "Site code already exists" }, { status: 400 });
  }

  const site = await Site.create({
    ...body,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  return NextResponse.json({ data: site }, { status: 201 });
}

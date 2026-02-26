import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Counter } from "@/lib/models/Counter";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const counter = await Counter.findOne({ _id: id, companyId: session.companyId })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!counter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: counter });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const counter = await Counter.findOneAndUpdate(
    { _id: id, companyId: session.companyId },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!counter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: counter });
}

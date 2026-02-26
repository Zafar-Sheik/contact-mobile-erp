import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Counter } from "@/lib/models/Counter";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const counters = await Counter.find({ companyId: session.companyId })
    .select("-isDeleted -deletedAt")
    .sort({ key: 1 })
    .lean();

  return NextResponse.json({ data: counters });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const counter = await Counter.create({
    ...body,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  return NextResponse.json({ data: counter }, { status: 201 });
}

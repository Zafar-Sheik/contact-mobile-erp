import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { WorkflowTask } from "@/lib/models/WorkflowTask";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await WorkflowTask.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .lean();

  if (!task) {
    return NextResponse.json({ error: "Workflow task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task });
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

  const task = await WorkflowTask.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    { ...body, updatedBy: session.userId },
    { new: true }
  );

  if (!task) {
    return NextResponse.json({ error: "Workflow task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await WorkflowTask.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!task) {
    return NextResponse.json({ error: "Workflow task not found" }, { status: 404 });
  }

  await task.softDelete(session.userId);

  return NextResponse.json({ message: "Workflow task deleted successfully" });
}

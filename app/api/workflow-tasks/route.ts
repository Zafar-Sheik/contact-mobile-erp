import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { WorkflowTask } from "@/lib/models/WorkflowTask";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await WorkflowTask.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("assigneeId", "firstName lastName email")
    .sort({ dueAt: 1, priority: -1 })
    .lean();

  return NextResponse.json({ data: tasks });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const task = await WorkflowTask.create({
    ...body,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  return NextResponse.json({ data: task }, { status: 201 });
}

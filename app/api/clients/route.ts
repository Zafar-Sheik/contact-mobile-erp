import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Client, generateClientCode } from "@/lib/models/Client";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Any authenticated user can view clients
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    await dbConnect();

    const clients = await Client.find({ companyId: session.companyId, isDeleted: false })
      .select("-isDeleted -deletedAt")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ ok: true, data: clients });
  } catch (error: any) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Only admin, manager, worker, owner can create clients
  const session = await requireRole(["admin", "manager", "worker", "owner"]);
  if (session instanceof NextResponse) return session;

  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Generate unique client code automatically if not provided
  // If clientCode is provided in body, use it; otherwise generate
  // If a duplicate key error occurs, we'll retry with a new code
  let clientCode = body.clientCode;
  let client;
  let createAttempts = 0;
  const maxCreateAttempts = 10;

  while (createAttempts < maxCreateAttempts) {
    try {
      // If no clientCode provided or we need to generate a new one
      if (!clientCode) {
        clientCode = await generateClientCode(session.companyId);
      }

      client = await Client.create({
        ...body,
        clientCode,
        companyId: session.companyId,
        createdBy: session.userId,
        updatedBy: session.userId,
      });
      break; // Success
    } catch (error: any) {
      // Check if it's a duplicate key error
      if (error.code === 11000 && error.keyPattern?.clientCode) {
        console.log(`[Client] Duplicate clientCode ${clientCode}, trying next...`);
        clientCode = null; // Force generate new code
        createAttempts++;
        continue;
      }
      // Re-throw other errors
      throw error;
    }
  }

  if (!client) {
    return NextResponse.json(
      { error: "Failed to generate unique client code after multiple attempts" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: client }, { status: 201 });
}

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { LabourCost } from "@/lib/models/LabourCost";
import { requireAuth, requireRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";

/**
 * GET /api/labour-costs
 * List all labour costs for the company
 */
export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");

    // Build query
    const query: any = { 
      companyId: session.companyId, 
      isDeleted: false 
    };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Active filter
    if (isActive !== null && isActive !== "") {
      query.isActive = isActive === "true";
    }

    const labourCosts = await LabourCost.find(query)
      .select("-isDeleted -deletedAt")
      .sort({ code: 1 })
      .lean();

    return NextResponse.json({ data: labourCosts });
  } catch (error: any) {
    console.error("Error fetching labour costs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch labour costs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/labour-costs
 * Create a new labour cost
 */
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "manager", "worker", "owner"]);
    if (session instanceof NextResponse) return session;

    await dbConnect();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate required fields
    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: "Code and name are required" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await LabourCost.findOne({
      companyId: session.companyId,
      code: body.code,
      isDeleted: false,
    });

    if (existing) {
      return NextResponse.json(
        { error: "A labour cost with this code already exists" },
        { status: 409 }
      );
    }

    const labourCost = await LabourCost.create({
      ...body,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    return NextResponse.json({ data: labourCost }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating labour cost:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create labour cost" },
      { status: 500 }
    );
  }
}

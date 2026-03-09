import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { LabourCost } from "@/lib/models/LabourCost";
import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { Types } from "mongoose";

export const runtime = "nodejs";

/**
 * GET /api/labour-costs/[id]
 * Get a single labour cost by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    await dbConnect();

    const labourCost = await LabourCost.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    }).select("-isDeleted -deletedAt");

    if (!labourCost) {
      return NextResponse.json({ error: "Labour cost not found" }, { status: 404 });
    }

    return NextResponse.json({ data: labourCost });
  } catch (error: any) {
    console.error("Error fetching labour cost:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch labour cost" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/labour-costs/[id]
 * Update a labour cost
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["admin", "manager", "worker", "owner"]);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    await dbConnect();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Check if labour cost exists
    const existing = await LabourCost.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!existing) {
      return NextResponse.json({ error: "Labour cost not found" }, { status: 404 });
    }

    // Check for duplicate code if code is being changed
    if (body.code && body.code !== existing.code) {
      const duplicate = await LabourCost.findOne({
        companyId: session.companyId,
        code: body.code,
        isDeleted: false,
        _id: { $ne: id },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A labour cost with this code already exists" },
          { status: 409 }
        );
      }
    }

    // Update fields
    const updatedLabourCost = await LabourCost.findByIdAndUpdate(
      id,
      {
        ...body,
        updatedBy: session.userId,
      },
      { new: true }
    ).select("-isDeleted -deletedAt");

    return NextResponse.json({ data: updatedLabourCost });
  } catch (error: any) {
    console.error("Error updating labour cost:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update labour cost" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/labour-costs/[id]
 * Soft delete a labour cost
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["admin", "manager", "owner"]);
    if (session instanceof NextResponse) return session;

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    await dbConnect();

    const labourCost = await LabourCost.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!labourCost) {
      return NextResponse.json({ error: "Labour cost not found" }, { status: 404 });
    }

    // Soft delete
    labourCost.isDeleted = true;
    labourCost.deletedAt = new Date();
    labourCost.updatedBy = session.userId;
    await labourCost.save();

    return NextResponse.json({ message: "Labour cost deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting labour cost:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete labour cost" },
      { status: 500 }
    );
  }
}

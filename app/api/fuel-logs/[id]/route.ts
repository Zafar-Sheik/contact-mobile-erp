import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { FuelLog } from "@/lib/models/FuelLog";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await FuelLog.findOne({ _id: id, companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("vehicleId", "name registration")
    .lean();

  if (!log) {
    return NextResponse.json({ error: "Fuel log not found" }, { status: 404 });
  }

  // Transform data to match frontend expectations
  const transformedLog: any = {
    ...log,
    vehicleId: (log as any).vehicleId?._id || (log as any).vehicleId,
    vehicleRegistration: (log as any).vehicleId?.registration || (log as any).vehicleId?.name || "Unknown",
    date: (log as any).filledAt,
    odometer: (log as any).odometerKm,
    liters: (log as any).liters,
    costPerLiter: (log as any).costCents ? (log as any).costCents / 100 / (log as any).liters : 0,
    totalCost: (log as any).costCents ? (log as any).costCents / 100 : 0,
  };

  return NextResponse.json({ data: transformedLog });
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

  // Map frontend fields to model fields
  const fuelLogData = {
    vehicleId: body.vehicleId,
    filledAt: body.date || new Date().toISOString(),
    odometerKm: body.odometer || 0,
    liters: body.liters || 0,
    costCents: body.totalCost ? Math.round(body.totalCost * 100) : 0,
    station: body.station || "",
    notes: body.notes || "",
    updatedBy: session.userId,
  };

  const log = await FuelLog.findOneAndUpdate(
    { _id: id, companyId: session.companyId, isDeleted: false },
    fuelLogData,
    { new: true }
  );

  if (!log) {
    return NextResponse.json({ error: "Fuel log not found" }, { status: 404 });
  }

  return NextResponse.json({ data: log });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await FuelLog.findOne({ _id: id, companyId: session.companyId, isDeleted: false });

  if (!log) {
    return NextResponse.json({ error: "Fuel log not found" }, { status: 404 });
  }

  // Use direct field assignment for soft delete
  log.isDeleted = true;
  log.deletedAt = new Date();
  log.deletedBy = session.userId;
  await log.save();

  return NextResponse.json({ message: "Fuel log deleted successfully" });
}

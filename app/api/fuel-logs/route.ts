import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { FuelLog } from "@/lib/models/FuelLog";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await FuelLog.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("vehicleId", "name registration")
    .sort({ filledAt: -1 })
    .lean();

  // Transform data to match frontend expectations
  const transformedLogs = logs.map((log: any) => ({
    ...log,
    vehicleId: log.vehicleId?._id || log.vehicleId,
    vehicleRegistration: log.vehicleId?.registration || log.vehicleId?.name || "Unknown",
    date: log.filledAt,
    odometer: log.odometerKm,
    liters: log.liters,
    costPerLiter: log.costCents ? log.costCents / 100 / log.liters : 0,
    totalCost: log.costCents ? log.costCents / 100 : 0,
  }));

  return NextResponse.json({ data: transformedLogs });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Validate required fields
  if (!body.vehicleId) {
    return NextResponse.json({ error: "Vehicle is required" }, { status: 400 });
  }

  // Calculate cost in cents
  const liters = Number(body.liters) || 0;
  const costPerLiter = Number(body.costPerLiter) || 0;
  const totalCostCents = Math.round(liters * costPerLiter * 100);

  // Map frontend fields to model fields
  const fuelLogData = {
    vehicleId: body.vehicleId,
    filledAt: body.date || new Date().toISOString(),
    odometerKm: Number(body.odometer) || 0,
    liters: liters,
    costCents: totalCostCents,
    station: body.station || "",
    notes: body.notes || "",
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  };

  const log = await FuelLog.create(fuelLogData);

  return NextResponse.json({ data: log }, { status: 201 });
}

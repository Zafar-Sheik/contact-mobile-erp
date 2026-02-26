import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Vehicle } from "@/lib/models/Vehicle";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vehicles = await Vehicle.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .sort({ registration: 1 })
    .lean();

  return NextResponse.json({ data: vehicles });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Ensure default values are set
  const vehicleData = {
    ...body,
    name: body.name || body.registration || `Vehicle ${body.registration}`,
    year: body.year || null,
    status: body.status || "active",
    fuelType: body.fuelType || "Diesel",
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  };

  const vehicle = await Vehicle.create(vehicleData);
  
  // Fetch the created vehicle to ensure we have all fields
  const createdVehicle = await Vehicle.findById(vehicle._id).lean();

  return NextResponse.json({ data: createdVehicle }, { status: 201 });
}

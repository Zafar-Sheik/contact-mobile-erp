import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const movements = await InventoryMovement.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("stockItemId", "name sku")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ data: movements });
}

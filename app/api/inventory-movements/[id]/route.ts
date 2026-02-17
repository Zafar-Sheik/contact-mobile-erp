import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if id is a valid ObjectId or a source reference
  const movements = await InventoryMovement.find({ 
    companyId: session.companyId, 
    isDeleted: false,
    $or: [
      { _id: id },
      { sourceId: id }
    ]
  })
    .select("-isDeleted -deletedAt")
    .populate("stockItemId", "name sku unit")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ data: movements });
}

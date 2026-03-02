import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItemUsage } from "@/lib/models/StockItemUsage";
import { getSessionClaims } from "@/lib/auth/session";

interface TrackUsageParams {
  stockItemId: string;
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    // Get session to enforce company scoping
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stockItemId = searchParams.get("stockItemId");

    if (!stockItemId) {
      return NextResponse.json(
        { error: "stockItemId is required" },
        { status: 400 }
      );
    }

    const companyId = session.companyId;

    // Use upsert to create or update the usage record
    await StockItemUsage.findOneAndUpdate(
      { companyId, stockItemId: new (await import("mongoose")).Types.ObjectId(stockItemId) },
      { lastUsedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Track usage error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

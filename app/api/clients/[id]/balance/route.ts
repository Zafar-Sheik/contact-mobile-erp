import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateClientBalance } from "@/lib/services/customer-payment-service";

// GET /api/clients/[id]/balance - Get client balance information
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const balance = await calculateClientBalance(id);

    return NextResponse.json({ data: balance });
  } catch (error: any) {
    console.error("Error fetching client balance:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
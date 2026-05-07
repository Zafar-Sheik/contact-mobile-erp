import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionClaims } from "@/lib/auth/session";
import { getPayInvoicesUIData } from "@/lib/services/customer-payment-service";

// GET /api/customer-payments/ui-data?clientId=... - Get UI data for payment form
export async function GET(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    const uiData = await getPayInvoicesUIData(clientId);
    if (!uiData) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ data: uiData });
  } catch (error: any) {
    console.error("Error fetching payment UI data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch UI data" },
      { status: 500 }
    );
  }
}
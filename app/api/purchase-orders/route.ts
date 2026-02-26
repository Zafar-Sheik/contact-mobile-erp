import { NextResponse } from "next/server";
import { getSessionClaims } from "@/lib/auth/session";
import {
  listPurchaseOrders,
  createPurchaseOrder,
} from "@/lib/services/po-service";

// GET /api/purchase-orders - List with pagination and filters
export async function GET(req: Request) {
  try {
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || undefined;
    const supplierId = searchParams.get("supplierId") || undefined;
    const q = searchParams.get("q") || undefined;
    const fromDate = searchParams.get("fromDate") ? new Date(searchParams.get("fromDate")!) : undefined;
    const toDate = searchParams.get("toDate") ? new Date(searchParams.get("toDate")!) : undefined;

    const result = await listPurchaseOrders(
      session.companyId,
      { status, supplierId, q, fromDate, toDate },
      page,
      limit
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error listing POs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create new PO
export async function POST(req: Request) {
  try {
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const result = await createPurchaseOrder(
      {
        supplierId: body.supplierId,
        expectedAt: body.expectedAt ? new Date(body.expectedAt) : undefined,
        notes: body.notes,
        lines: body.lines || [],
      },
      session.userId,
      session.companyId
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating PO:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

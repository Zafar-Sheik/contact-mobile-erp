import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesQuote } from "@/lib/models/SalesQuote";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { Client } from "@/lib/models/Client";
import { Counter } from "@/lib/models/Counter";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateDocumentTotals, calculateLineTotal } from "@/lib/utils/totals";
import { StockItem } from "@/lib/models/StockItem";

// GET /api/quotes - List all quotes with pagination
export async function GET(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const search = searchParams.get("search");

    // Build query
    const query: any = { companyId: session.companyId, isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (clientId) {
      query.clientId = clientId;
    }

    if (search) {
      query.$or = [
        { quoteNumber: { $regex: search, $options: "i" } },
        { "clientSnapshot.name": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      SalesQuote.find(query)
        .select("-isDeleted -deletedAt")
        .populate("clientId", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SalesQuote.countDocuments(query),
    ]);

    return NextResponse.json({
      data: quotes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch quotes" }, { status: 500 });
  }
}

// POST /api/quotes - Create a new quote
export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate required fields
    if (!body.clientId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 });
    }

    if (!body.lines || body.lines.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
    }

    // Verify client exists
    const client = await Client.findOne({
      _id: body.clientId,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create client snapshot
    const clientSnapshot = {
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      address: {
        line1: client.billing?.address?.line1 || "",
        line2: client.billing?.address?.line2 || "",
        city: client.billing?.address?.city || "",
        provinceState: client.billing?.address?.provinceState || "",
        country: client.billing?.address?.country || "South Africa",
        postalCode: client.billing?.address?.postalCode || "",
      },
    };

    // Generate quote number using QTE counter
    const counter = await Counter.findOneAndUpdate(
      { companyId: session.companyId, key: "QTE" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true }
    );
    const sequence = String(counter.nextNumber).padStart(5, "0");
    const quoteNumber = `QTE-${sequence}`;

    // Process lines and calculate totals
    const vatMode = body.vatMode || "exclusive";
    const vatRateBps = body.vatRateBps || 1500;

    const processedLines = await Promise.all(
      body.lines.map(async (line: any, index: number) => {
        const qty = line.qty || 0;
        const unitPriceCents = line.unitPriceCents || 0;
        const discountCents = line.discountCents || 0;
        const taxable = line.taxable !== false;

        // Get stock item for snapshot if provided
        let skuSnapshot = "";
        let nameSnapshot = "";

        if (line.stockItemId) {
          const stockItem = await StockItem.findById(line.stockItemId).lean();
          if (stockItem) {
            skuSnapshot = stockItem.sku || "";
            nameSnapshot = stockItem.name || "";
          }
        }

        // Calculate line total
        const lineTotalCents = calculateLineTotal(qty, unitPriceCents, discountCents);

        return {
          lineNo: index + 1,
          stockItemId: line.stockItemId || null,
          skuSnapshot: line.skuSnapshot || skuSnapshot,
          nameSnapshot: line.nameSnapshot || nameSnapshot,
          qty,
          unitPriceCents,
          discountCents,
          taxable,
          lineTotalCents,
        };
      })
    );

    // Calculate document totals
    const totals = calculateDocumentTotals(
      processedLines,
      vatRateBps,
      vatMode
    );

    // Calculate validUntil (default 30 days from now if not provided)
    const validUntil = body.validUntil
      ? new Date(body.validUntil)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const quoteData = {
      quoteNumber,
      clientId: body.clientId,
      clientSnapshot,
      status: "draft",
      lines: processedLines,
      totals,
      vatMode,
      vatRateBps,
      validUntil,
      notes: body.notes || "",
      sentAt: null,
      acceptedAt: null,
      rejectedAt: null,
      expiredAt: null,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    };

    const quote = await SalesQuote.create(quoteData);

    // Populate client for response
    await quote.populate("clientId", "name email phone");

    return NextResponse.json({ data: quote }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quote:", error);
    return NextResponse.json({ error: error.message || "Failed to create quote" }, { status: 500 });
  }
}

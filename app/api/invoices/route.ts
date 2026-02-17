import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { Client } from "@/lib/models/Client";
import { Counter } from "@/lib/models/Counter";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateDocumentTotals, calculateLineTotal, isOverdue } from "@/lib/utils/totals";
import { StockItem } from "@/lib/models/StockItem";

// GET /api/invoices - List all invoices with pagination
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
    const overdue = searchParams.get("overdue");

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
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "clientSnapshot.name": { $regex: search, $options: "i" } },
      ];
    }

    // Handle overdue filter
    if (overdue === "true") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.dueDate = { $lt: today };
      query.status = { $in: ["issued", "partially_paid"] };
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      SalesInvoice.find(query)
        .select("-isDeleted -deletedAt")
        .populate("clientId", "name email phone")
        .populate("sourceQuoteId", "quoteNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SalesInvoice.countDocuments(query),
    ]);

    // Mark overdue invoices
    const now = new Date();
    const invoicesWithOverdueStatus = invoices.map((invoice: any) => {
      if (
        invoice.status !== "paid" &&
        invoice.status !== "cancelled" &&
        invoice.status !== "draft" &&
        new Date(invoice.dueDate) < now
      ) {
        return { ...invoice, isOverdue: true };
      }
      return { ...invoice, isOverdue: false };
    });

    return NextResponse.json({
      data: invoicesWithOverdueStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch invoices" }, { status: 500 });
  }
}

// POST /api/invoices - Create a new invoice
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

    // Generate invoice number using INV counter
    const counter = await Counter.findOneAndUpdate(
      { companyId: session.companyId, key: "INV" },
      { $inc: { nextNumber: 1 } },
      { upsert: true, new: true }
    );
    const sequence = String(counter.nextNumber).padStart(5, "0");
    const invoiceNumber = `INV-${sequence}`;

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

    // Set dates
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoiceData = {
      invoiceNumber,
      clientId: body.clientId,
      clientSnapshot,
      status: "draft",
      lines: processedLines,
      totals,
      amountPaidCents: 0,
      balanceDueCents: totals.totalCents,
      sourceQuoteId: body.sourceQuoteId || null,
      vatMode,
      vatRateBps,
      issueDate,
      dueDate,
      notes: body.notes || "",
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    };

    const invoice = await SalesInvoice.create(invoiceData);

    // Populate client for response
    await invoice.populate("clientId", "name email phone");

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: error.message || "Failed to create invoice" }, { status: 500 });
  }
}

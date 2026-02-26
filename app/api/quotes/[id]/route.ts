import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesQuote } from "@/lib/models/SalesQuote";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateDocumentTotals, calculateLineTotal } from "@/lib/utils/totals";
import { StockItem } from "@/lib/models/StockItem";

// GET /api/quotes/[id] - Get a single quote by ID
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

    const quote = await SalesQuote.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    })
      .populate("clientId", "name email phone address")
      .lean();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Check if there's a related invoice (if converted)
    const relatedInvoice = await SalesInvoice.findOne({
      sourceQuoteId: id,
      isDeleted: false,
    })
      .select("invoiceNumber status")
      .lean();

    const response: any = { data: quote };
    if (relatedInvoice) {
      response.data.relatedInvoice = relatedInvoice;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching quote:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch quote" }, { status: 500 });
  }
}

// PATCH /api/quotes/[id] - Update a quote
export async function PATCH(
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

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Check if quote exists
    const existingQuote = await SalesQuote.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!existingQuote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Only allow updates if status is draft or sent
    if (!["draft", "sent"].includes(existingQuote.status)) {
      return NextResponse.json(
        { error: "Only draft or sent quotes can be edited" },
        { status: 400 }
      );
    }

    // If updating lines, recalculate totals
    if (body.lines) {
      const vatMode = body.vatMode || existingQuote.vatMode;
      const vatRateBps = body.vatRateBps ?? existingQuote.vatRateBps;

      const processedLines = await Promise.all(
        body.lines.map(async (line: any, index: number) => {
          const qty = line.qty || 0;
          const unitPriceCents = line.unitPriceCents || 0;
          const discountCents = line.discountCents || 0;
          const taxable = line.taxable !== false;

          // Get stock item for snapshot if provided
          let skuSnapshot = line.skuSnapshot || "";
          let nameSnapshot = line.nameSnapshot || "";

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
            skuSnapshot,
            nameSnapshot,
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

      body.lines = processedLines;
      body.totals = totals;
      body.vatMode = vatMode;
      body.vatRateBps = vatRateBps;
    }

    // Update validUntil if provided
    if (body.validUntil !== undefined) {
      body.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    }

    // If status is being changed, handle timestamps
    if (body.status) {
      const currentStatus = existingQuote.status;
      const newStatus = body.status;

      if (newStatus === "sent" && currentStatus === "draft") {
        body.sentAt = new Date();
      } else if (newStatus === "accepted" && currentStatus === "sent") {
        body.acceptedAt = new Date();
      } else if (newStatus === "rejected" && currentStatus === "sent") {
        body.rejectedAt = new Date();
      }
    }

    // Update the quote
    const quote = await SalesQuote.findOneAndUpdate(
      { _id: id, companyId: session.companyId, isDeleted: false },
      { ...body, updatedBy: session.userId },
      { new: true }
    ).populate("clientId", "name email phone");

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ data: quote });
  } catch (error: any) {
    console.error("Error updating quote:", error);
    return NextResponse.json({ error: error.message || "Failed to update quote" }, { status: 500 });
  }
}

// DELETE /api/quotes/[id] - Soft delete a quote (only if draft)
export async function DELETE(
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

    const quote = await SalesQuote.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft quotes can be deleted" },
        { status: 400 }
      );
    }

    await quote.softDelete(session.userId);

    return NextResponse.json({ message: "Quote deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting quote:", error);
    return NextResponse.json({ error: error.message || "Failed to delete quote" }, { status: 500 });
  }
}

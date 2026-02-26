import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesQuote } from "@/lib/models/SalesQuote";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { getSessionClaims } from "@/lib/auth/session";
import { generateDocumentNumber } from "@/lib/utils/numbering";

// POST /api/quotes/[id]/convert-to-invoice - Create a new SalesInvoice from this quote
export async function POST(
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

    // Get the quote
    const quote = await SalesQuote.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Only allow conversion from accepted or draft quotes
    if (!["accepted", "draft"].includes(quote.status)) {
      return NextResponse.json(
        { error: "Only accepted or draft quotes can be converted to invoice" },
        { status: 400 }
      );
    }

    // Check if quote is already converted
    const existingInvoice = await SalesInvoice.findOne({
      sourceQuoteId: id,
      isDeleted: false,
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: "This quote has already been converted to an invoice" },
        { status: 400 }
      );
    }

    // Generate invoice number using the numbering system
    const invoiceNumber = await generateDocumentNumber(session.companyId, "invoice", session.userId);

    // Calculate dates
    const today = new Date();
    const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // Due in 30 days

    // Convert quote lines to invoice lines
    const invoiceLines = quote.lines.map((line: any) => ({
      lineNo: line.lineNo,
      stockItemId: line.stockItemId,
      skuSnapshot: line.skuSnapshot,
      nameSnapshot: line.nameSnapshot,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      discountCents: line.discountCents,
      taxable: line.taxable,
      lineTotalCents: line.lineTotalCents,
    }));

    // Create the invoice
    const invoiceData = {
      invoiceNumber,
      clientId: quote.clientId,
      clientSnapshot: quote.clientSnapshot,
      status: "draft",
      lines: invoiceLines,
      totals: quote.totals,
      amountPaidCents: 0,
      balanceDueCents: quote.totals.totalCents,
      sourceQuoteId: quote._id,
      vatMode: quote.vatMode,
      vatRateBps: quote.vatRateBps,
      issueDate: today,
      dueDate: dueDate,
      notes: quote.notes || "",
      issuedAt: null,
      paidAt: null,
      cancelledAt: null,
      overdueAt: null,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    };

    const invoice = await SalesInvoice.create(invoiceData);

    // Populate client for response
    await invoice.populate("clientId", "name email phone");

    return NextResponse.json(
      {
        message: "Invoice created successfully from quote",
        data: invoice,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error converting quote to invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert quote to invoice" },
      { status: 500 }
    );
  }
}

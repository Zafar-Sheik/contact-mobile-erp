import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import { getSessionClaims } from "@/lib/auth/session";
import { calculateDocumentTotals, calculateLineTotal, calculateBalanceDue } from "@/lib/utils/totals";
import { StockItem } from "@/lib/models/StockItem";

// GET /api/invoices/[id] - Get a single invoice by ID
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

    const invoice = await SalesInvoice.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    })
      .populate("clientId", "name email phone address")
      .populate("sourceQuoteId", "quoteNumber")
      .lean();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get payment history for this invoice
    const payments = await CustomerPayment.find({
      companyId: session.companyId,
      isDeleted: false,
      "allocatedInvoices.invoiceId": id,
    })
      .populate("clientId", "name email")
      .sort({ paymentDate: -1 })
      .lean();

    // Check if overdue
    const now = new Date();
    const isOverdueFlag = 
      invoice.status !== "paid" && 
      invoice.status !== "cancelled" && 
      invoice.status !== "draft" && 
      new Date(invoice.dueDate) < now;

    return NextResponse.json({ 
      data: { 
        ...invoice, 
        isOverdue: isOverdueFlag,
        paymentHistory: payments 
      } 
    });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch invoice" }, { status: 500 });
  }
}

// PATCH /api/invoices/[id] - Update an invoice
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

    // Check if invoice exists
    const existingInvoice = await SalesInvoice.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow updates if status is draft
    if (existingInvoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be edited" },
        { status: 400 }
      );
    }

    // If updating lines, recalculate totals
    if (body.lines) {
      const vatMode = body.vatMode || existingInvoice.vatMode;
      const vatRateBps = body.vatRateBps ?? existingInvoice.vatRateBps;

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

      // Calculate balance due
      const amountPaidCents = body.amountPaidCents ?? existingInvoice.amountPaidCents;
      const balanceDueCents = calculateBalanceDue(totals.totalCents, amountPaidCents);

      body.lines = processedLines;
      body.totals = totals;
      body.balanceDueCents = balanceDueCents;
      body.vatMode = vatMode;
      body.vatRateBps = vatRateBps;
    }

    // If amountPaidCents changed without lines update, recalculate balance
    if (body.amountPaidCents !== undefined && !body.lines) {
      const totalCents = existingInvoice.totals.totalCents;
      const balanceDueCents = calculateBalanceDue(totalCents, body.amountPaidCents);
      body.balanceDueCents = balanceDueCents;
    }

    // Update dates if provided
    if (body.issueDate !== undefined) {
      body.issueDate = body.issueDate ? new Date(body.issueDate) : null;
    }

    if (body.dueDate !== undefined) {
      body.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    // Update the invoice
    const invoice = await SalesInvoice.findOneAndUpdate(
      { _id: id, companyId: session.companyId, isDeleted: false },
      { ...body, updatedBy: session.userId },
      { new: true }
    ).populate("clientId", "name email phone");

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ data: invoice });
  } catch (error: any) {
    console.error("Error updating invoice:", error);
    return NextResponse.json({ error: error.message || "Failed to update invoice" }, { status: 500 });
  }
}

// DELETE /api/invoices/[id] - Soft delete invoice (only if draft)
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

    const invoice = await SalesInvoice.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be deleted" },
        { status: 400 }
      );
    }

    await invoice.softDelete(session.userId);

    return NextResponse.json({ message: "Invoice deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json({ error: error.message || "Failed to delete invoice" }, { status: 500 });
  }
}

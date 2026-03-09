import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { Client } from "@/lib/models/Client";
import { StockItem } from "@/lib/models/StockItem";
import { requireAuth, requireRole } from "@/lib/auth/rbac";
import { Types } from "mongoose";

export const runtime = "nodejs";

/**
 * POST /api/invoices/create-from-grv
 * 
 * Create an invoice from a GRV
 * - Populate invoice lines from GRV items
 * - Each line item is editable (quantity, price)
 * - Link GRV to invoice for traceability
 * - Does NOT update stock inventory
 */
export async function POST(req: Request) {
  try {
    const session = await requireRole(["admin", "manager", "worker", "owner"]);
    if (session instanceof NextResponse) return session;

    await dbConnect();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { grvId, clientId, lines } = body;

    // Validate required fields
    if (!grvId || !clientId || !lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: "GRV ID, Client ID, and lines are required" },
        { status: 400 }
      );
    }

    if (!Types.ObjectId.isValid(grvId)) {
      return NextResponse.json({ error: "Invalid GRV ID format" }, { status: 400 });
    }

    // Fetch the GRV
    const grv = await GRV.findOne({
      _id: grvId,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!grv) {
      return NextResponse.json(
        { error: "GRV not found" },
        { status: 404 }
      );
    }

    // Check if GRV already has an invoice
    if (grv.invoiceId) {
      return NextResponse.json(
        { error: "This GRV already has an invoice" },
        { status: 400 }
      );
    }

    // Fetch the Client
    const client = await Client.findOne({
      _id: clientId,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Calculate totals
    let subtotalCents = 0;
    let vatTotalCents = 0;

    const invoiceLines = lines.map((line: any, index: number) => {
      const lineTotal = (line.quantity || 0) * (line.unitPriceCents || 0);
      const vatAmount = line.taxable !== false ? Math.round(lineTotal * 0.15) : 0;
      
      subtotalCents += lineTotal;
      vatTotalCents += vatAmount;

      return {
        lineNo: index + 1,
        stockItemId: line.stockItemId || null,
        skuSnapshot: line.sku || "",
        nameSnapshot: line.name || "",
        descriptionSnapshot: line.description || "",
        unitSnapshot: line.unit || "each",
        qty: line.quantity || 0,
        unitPriceCents: line.unitPriceCents || 0,
        discountCents: line.discountCents || 0,
        taxable: line.taxable !== false,
        lineTotalCents: lineTotal + vatAmount,
      };
    });

    const totalCents = subtotalCents + vatTotalCents;

    // Get next invoice number
    const counter = await import("@/lib/models/Counter").then(m => m.Counter);
    const counterDoc = await counter.findOneAndUpdate(
      { companyId: session.companyId, key: "INVOICE" },
      { $inc: { nextNumber: 1 } },
      { new: true, upsert: true }
    );
    const invoiceNumber = `INV-${String(counterDoc.nextNumber).padStart(5, "0")}`;

    // Create the invoice
    const invoice = await SalesInvoice.create({
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
      invoiceNumber,
      clientId: client._id,
      clientSnapshot: {
        name: client.name,
        email: client.email || "",
        phone: client.phone || "",
        address: client.billing?.address || {
          line1: "", line2: "", city: "", provinceState: "", country: "South Africa", postalCode: ""
        },
      },
      status: "draft",
      lines: invoiceLines,
      totals: {
        subTotalCents: subtotalCents,
        vatTotalCents: vatTotalCents,
        totalCents: totalCents,
      },
      amountPaidCents: 0,
      balanceDueCents: totalCents,
      sourceGrvId: grv._id,
      vatMode: "exclusive",
      vatRateBps: 1500,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }) as unknown as import("@/lib/models/SalesInvoice").ISalesInvoice;

    // Update GRV with invoice reference
    grv.invoiceId = invoice._id;
    await grv.save();

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating invoice from GRV:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invoice from GRV" },
      { status: 500 }
    );
  }
}

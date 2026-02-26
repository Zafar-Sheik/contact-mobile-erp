import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { Counter } from "@/lib/models/Counter";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";
import { generateDocumentNumber } from "@/lib/utils/numbering";
import { validateBillToGRVs, getSupplierForDocument } from "@/lib/utils/p2p-validation";
import { Types } from "mongoose";

// GET /api/supplier-bills - List all supplier bills with optional filters
export async function GET(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Build query
    const query: any = { companyId: session.companyId, isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (supplierId) {
      query.supplierId = supplierId;
    }

    if (fromDate || toDate) {
      query.billDate = {};
      if (fromDate) {
        query.billDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.billDate.$lte = new Date(toDate);
      }
    }

    const bills = await SupplierBill.find(query)
      .select("-isDeleted -deletedAt")
      .populate("supplierId", "name email phone")
      .populate("poId", "poNumber")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ data: bills });
  } catch (error: any) {
    console.error("Error fetching supplier bills:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch supplier bills" }, { status: 500 });
  }
}

// POST /api/supplier-bills - Create a new supplier bill
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
    if (!body.supplierId) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }

    if (!body.billDate) {
      return NextResponse.json({ error: "Bill date is required" }, { status: 400 });
    }

    if (!body.billLines || body.billLines.length === 0) {
      return NextResponse.json({ error: "At least one bill line is required" }, { status: 400 });
    }

    // Validate supplier exists
    const supplier = await getSupplierForDocument(body.supplierId);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 400 });
    }

    // CRITICAL: Validate GRV links - prevent cross-supplier linking
    if (body.grvIds && body.grvIds.length > 0) {
      const grvValidation = await validateBillToGRVs(
        body.supplierId,
        body.grvIds
      );
      
      if (!grvValidation.valid) {
        return NextResponse.json({ 
          error: grvValidation.errors.join("; ") 
        }, { status: 400 });
      }
      
      if (grvValidation.warnings.length > 0) {
        console.warn("GRV validation warnings:", grvValidation.warnings);
      }
    }

    // Generate bill number using new system
    const billNumber = await generateDocumentNumber(session.companyId, "bill", session.userId);

    // Process lines and calculate totals
    let subtotalCents = 0;
    let vatTotalCents = 0;
    const discountCents = body.discountCents || 0;

    const processedLines = await Promise.all(
      body.billLines.map(async (line: any, index: number) => {
        const quantity = line.quantity || 0;
        const unitCostCents = line.unitCostCents || 0;
        const vatRate = line.vatRate || 15;

        // Get stock item for snapshot
        let itemSnapshot = {
          sku: "",
          name: line.description || "Unknown Item",
          unit: "each",
          vatRate: vatRate,
          isVatExempt: false,
        };

        if (line.stockItemId) {
          const stockItem = await StockItem.findById(line.stockItemId).lean();
          if (stockItem) {
            itemSnapshot = {
              sku: stockItem.sku || "",
              name: stockItem.name || line.description || "Unknown Item",
              unit: stockItem.unit || "each",
              vatRate: stockItem.tax?.vatRate || vatRate,
              isVatExempt: stockItem.tax?.isVatExempt || false,
            };
          }
        }

        // Calculate line amounts
        const lineSubtotal = unitCostCents * quantity;
        const vatAmount = itemSnapshot.isVatExempt ? 0 : Math.round(lineSubtotal * (itemSnapshot.vatRate / 100));
        const lineTotal = lineSubtotal + vatAmount;

        subtotalCents += lineSubtotal;
        vatTotalCents += vatAmount;

        return {
          lineNo: index + 1,
          stockItemId: line.stockItemId,
          itemSnapshot,
          description: line.description || itemSnapshot.name,
          quantity,
          unitCostCents,
          vatRate: itemSnapshot.vatRate,
          vatCents: vatAmount,
          subtotalCents: lineTotal,
          grvId: line.grvId,
          poLineId: line.poLineId || null,
        };
      })
    );

    const totalCents = subtotalCents + vatTotalCents - discountCents;

    // Extract GRV IDs from lines
    const grvIds = [...new Set(processedLines.map((line: any) => line.grvId).filter(Boolean))];

    const billData = {
      billNumber,
      supplierId: body.supplierId,
      poId: body.poId || null,
      grvIds,
      billDate: new Date(body.billDate),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: "DRAFT",
      reference: body.reference || "",      subtotalCents,
      vatCents: vatTotalCents,
      discountCents,
      totalCents,
      paidCents: 0,
      notes: body.notes || "",
      billLines: processedLines,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    };

    const bill = await SupplierBill.create(billData);

    return NextResponse.json({ data: bill }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating supplier bill:", error);
    return NextResponse.json({ error: error.message || "Failed to create supplier bill" }, { status: 500 });
  }
}

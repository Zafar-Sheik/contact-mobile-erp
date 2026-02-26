import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { Counter } from "@/lib/models/Counter";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";
import { generateDocumentNumber } from "@/lib/utils/numbering";
import { validateGRVToPO, getSupplierForDocument } from "@/lib/utils/p2p-validation";
import { Types } from "mongoose";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const grvs = await GRV.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .populate("poId", "poNumber")
    .sort({ createdAt: -1 })
    .lean();

  // Transform to include PO number
  const transformedGRVs = grvs.map((grv: any) => ({
    ...grv,
    poNumber: grv.poId?.poNumber || null,
  }));

  return NextResponse.json({ data: transformedGRVs });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Validate supplierId is provided
  if (!body.supplierId) {
    return NextResponse.json({ error: "Supplier is required. Please select a supplier." }, { status: 400 });
  }

  // Validate supplier exists
  const supplier = await getSupplierForDocument(body.supplierId);
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 400 });
  }

  // Validate PO link if provided (CRITICAL: cross-supplier check)
  // Skip full validation for new GRVs - validation runs on update
  if (body.poId) {
    // Always check if PO supplier matches GRV supplier (for both new and existing GRVs)
    const { PurchaseOrder } = await import("@/lib/models/PurchaseOrder");
    const po = await PurchaseOrder.findById(body.poId).lean();
    
    if (po) {
      const poSupplierId = (po.supplierId as any)?._id || po.supplierId;
      if (poSupplierId?.toString() !== body.supplierId) {
        return NextResponse.json({ 
          error: "Cross-supplier linking detected: GRV supplier must match PO supplier" 
        }, { status: 400 });
      }
    }
    
    // Run full validation only for existing GRVs (updates)
    if (body.grvId) {
      const poValidation = await validateGRVToPO(
        new Types.ObjectId(body.grvId),
        new Types.ObjectId(body.poId)
      );
    }
  }

  // Generate GRV number using new system
  const grvNumber = await generateDocumentNumber(session.companyId, "grv", session.userId);

  // Process lines and calculate totals
  let subtotalCents = 0;
  let vatTotalCents = 0;
  let discountTotalCents = 0;

  const processedLines = body.lines?.map((line: any, index: number) => {
    const receivedQty = line.receivedQty || 0;
    const unitCostCents = line.unitCostCents || 0;
    
    // Calculate discount
    let discountCents = 0;
    if (line.discountType === "percent" && line.discountValue) {
      discountCents = Math.round((unitCostCents * receivedQty * line.discountValue) / 100);
    } else if (line.discountType === "amount") {
      discountCents = line.discountValue * receivedQty;
    }

    const lineSubtotal = (unitCostCents * receivedQty) - discountCents;
    const vatRate = line.itemSnapshot?.vatRate || 15;
    const vatAmount = Math.round(lineSubtotal * (vatRate / 100));
    const lineTotal = lineSubtotal + vatAmount;

    subtotalCents += lineSubtotal;
    vatTotalCents += vatAmount;
    discountTotalCents += discountCents;

    return {
      lineNo: index + 1,
      ...line,
      subtotalCents: lineSubtotal,
      vatAmountCents: vatAmount,
      totalCents: lineTotal,
    };
  }) || [];

  const grandTotalCents = subtotalCents + vatTotalCents - discountTotalCents;

  const grvData = {
    ...body,
    lines: processedLines,
    grvNumber,
    subtotalCents,
    vatTotalCents,
    discountTotalCents,
    grandTotalCents,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  };

  const grv = await GRV.create(grvData);

  return NextResponse.json({ data: grv }, { status: 201 });
}

/**
 * Matching Service
 * 
 * Implements 2-way and 3-way invoice matching:
 * - 2-way: PO ↔ Bill
 * - 3-way: PO ↔ GRV ↔ Bill
 */

import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { Types } from "mongoose";

import {
  MatchStatus,
  MatchType,
  MatchTolerance,
  DEFAULT_MATCH_TOLERANCE,
  MatchResult,
  MatchReason,
  BillMatchLine,
  MatchSnapshot,
  MatchingPanelData,
} from "@/lib/types/matching";

/**
 * Match a bill against PO and GRVs
 * 
 * Returns MatchResult with line-by-line details
 */
export async function matchBill(
  billId: string,
  tolerance: MatchTolerance = DEFAULT_MATCH_TOLERANCE
): Promise<MatchResult> {
  await dbConnect();

  const result: MatchResult = {
    billId: new Types.ObjectId(billId),
    billNumber: "",
    matchType: MatchType.TWO_WAY,
    status: MatchStatus.PENDING,
    requiresApprovalOverride: false,
    reasons: [],
    lines: [],
    totals: {
      poTotal: 0,
      grvTotal: 0,
      billTotal: 0,
      variance: 0,
      variancePercent: 0,
    },
    matchedAt: new Date(),
  };

  // Get bill
  const bill = await SupplierBill.findById(billId)
    .populate("supplierId", "name")
    .lean();

  if (!bill) {
    result.reasons.push({
      code: "BILL_NOT_FOUND",
      message: "Bill not found",
      severity: "ERROR",
    });
    result.status = MatchStatus.FAIL;
    return result;
  }

  result.billNumber = bill.billNumber;
  result.totals.billTotal = bill.totalCents || 0;

  // Get GRVs linked to this bill
  const grvs = await GRV.find({
    _id: { $in: bill.grvIds || [] },
    status: "POSTED",
  })
    .populate("poId", "poNumber")
    .lean();

  // Get PO if linked
  let po = null;
  if (bill.poId) {
    po = await PurchaseOrder.findById(bill.poId).lean();
  }

  // Determine match type
  result.matchType = grvs.length > 0 ? MatchType.THREE_WAY : MatchType.TWO_WAY;

  // Process each bill line
  let passedLines = 0;
  let warningLines = 0;
  let failedLines = 0;
  let totalGRVValue = 0;
  let totalPOValue = 0;

  for (const billLine of bill.billLines || []) {
    const lineResult = await matchBillLine(
      billLine,
      grvs,
      po,
      tolerance
    );

    result.lines.push(lineResult);
    totalGRVValue += lineResult.matchedQty * (lineResult.grvLineId ? billLine.unitCostCents : 0);
    totalPOValue += lineResult.matchedQty * (lineResult.poUnitCost || billLine.unitCostCents);

    if (lineResult.status === MatchStatus.PASS) {
      passedLines++;
    } else if (lineResult.status === MatchStatus.WARNING) {
      warningLines++;
    } else {
      failedLines++;
    }
  }

  result.totals.grvTotal = totalGRVValue;
  result.totals.poTotal = totalPOValue;

  // Calculate variance
  result.totals.variance = result.totals.billTotal - totalGRVValue;
  result.totals.variancePercent =
    totalGRVValue > 0
      ? (result.totals.variance / totalGRVValue) * 100
      : 0;

  // Determine overall status
  if (failedLines > 0) {
    result.status = MatchStatus.FAIL;
    result.requiresApprovalOverride = true;
    result.reasons.push({
      code: "LINES_FAILED",
      message: `${failedLines} line(s) failed matching`,
      severity: "ERROR",
    });
  } else if (warningLines > 0) {
    result.status = MatchStatus.WARNING;
    result.requiresApprovalOverride = tolerance.priceVariancePercent > 0 || tolerance.amountVariancePercent > 0;
    result.reasons.push({
      code: "LINES_WARNING",
      message: `${warningLines} line(s) have warnings`,
      severity: "WARNING",
    });
  } else {
    result.status = MatchStatus.PASS;
  }

  return result;
}

/**
 * Match a single bill line against GRV/PO
 */
async function matchBillLine(
  billLine: any,
  grvs: any[],
  po: any,
  tolerance: MatchTolerance
): Promise<BillMatchLine> {
  const result: BillMatchLine = {
    lineNo: billLine.lineNo,
    stockItemId: billLine.stockItemId,
    itemName: billLine.description || billLine.itemSnapshot?.name || "Unknown",
    billQty: billLine.quantity,
    billUnitCost: billLine.unitCostCents,
    billLineTotal: billLine.subtotalCents || billLine.quantity * billLine.unitCostCents,
    matchedQty: 0,
    unmatchedQty: 0,
    overReceiptQty: 0,
    priceVariance: 0,
    priceVariancePercent: 0,
    isPriceMatch: true,
    status: MatchStatus.PASS,
    reasons: [],
  };

  // Find matching GRV lines
  const matchingGRVs: Array<{
    grv: any;
    line: any;
    qty: number;
  }> = [];

  for (const grv of grvs) {
    const grvLine = grv.lines?.find(
      (l: any) => l.stockItemId?.toString() === billLine.stockItemId?.toString()
    );

    if (grvLine) {
      matchingGRVs.push({
        grv,
        line: grvLine,
        qty: grvLine.receivedQty || 0,
      });
      
      // Store first match for reference
      if (!result.grvId) {
        result.grvId = grv._id;
        result.grvNumber = grv.grvNumber;
        result.grvLineId = grvLine._id;
        result.grvReceivedQty = grvLine.receivedQty;
      }
    }
  }

  // Find matching PO line
  if (po?.lines) {
    const poLine = po.lines.find(
      (l: any) => l.stockItemId?.toString() === billLine.stockItemId?.toString()
    );

    if (poLine) {
      result.poId = po._id;
      result.poNumber = (po as any).poNumber;
      result.poLineId = poLine._id;
      result.poOrderedQty = poLine.orderedQty;
      result.poUnitCost = poLine.unitCostCents;
    }
  }

  // Calculate total received qty from GRVs
  const totalReceived = matchingGRVs.reduce((sum, g) => sum + g.qty, 0);

  // Check quantity matching
  if (matchingGRVs.length === 0) {
    // No GRV found - 2-way match only
    result.unmatchedQty = result.billQty;
    result.status = MatchStatus.FAIL;
    result.reasons.push({
      code: "NO_GRV",
      message: "No GRV found for this item",
      severity: "ERROR",
      lineNo: result.lineNo,
    });
  } else {
    // 3-way match possible
    result.matchedQty = Math.min(result.billQty, totalReceived);
    result.unmatchedQty = Math.max(0, result.billQty - totalReceived);
    result.overReceiptQty = Math.max(0, result.billQty - totalReceived);

    // Check over-receipt
    if (result.overReceiptQty > 0) {
      const overPercent = (result.overReceiptQty / totalReceived) * 100;
      
      if (!tolerance.allowOverReceipt || overPercent > tolerance.overReceiptPercent) {
        result.status = MatchStatus.FAIL;
        result.reasons.push({
          code: "OVER_RECEIPT",
          message: `Billed qty (${result.billQty}) exceeds received qty (${totalReceived})`,
          severity: "ERROR",
          lineNo: result.lineNo,
        });
      } else {
        result.status = MatchStatus.WARNING;
        result.reasons.push({
          code: "OVER_RECEIPT_WARN",
          message: `Over-receipt: ${result.overReceiptQty} units`,
          severity: "WARNING",
          lineNo: result.lineNo,
        });
      }
    }

    // Check under-receipt (bill less than received - usually OK but warn)
    if (result.unmatchedQty > 0 && totalReceived > result.billQty) {
      result.status = result.status === MatchStatus.FAIL ? result.status : MatchStatus.WARNING;
      result.reasons.push({
        code: "UNDER_RECEIPT",
        message: `Partial billing: ${result.billQty} of ${totalReceived} received`,
        severity: "WARNING",
        lineNo: result.lineNo,
      });
    }
  }

  // Check price matching
  const billPrice = result.billUnitCost;
  const poPrice = result.poUnitCost || billPrice;
  result.priceVariance = Math.abs(billPrice - poPrice);
  
  if (poPrice > 0) {
    result.priceVariancePercent = (result.priceVariance / poPrice) * 100;
  }

  const priceToleranceMet =
    result.priceVariance <= tolerance.priceVarianceAbsolute ||
    result.priceVariancePercent <= tolerance.priceVariancePercent;

  result.isPriceMatch = priceToleranceMet;

  if (!priceToleranceMet) {
    result.status = result.status === MatchStatus.FAIL ? result.status : MatchStatus.WARNING;
    result.reasons.push({
      code: "PRICE_VARIANCE",
      message: `Price variance: R${(result.priceVariance / 100).toFixed(2)} (${result.priceVariancePercent.toFixed(1)}%)`,
      severity: tolerance.priceVariancePercent > 0 ? "WARNING" : "ERROR",
      lineNo: result.lineNo,
      field: "unitCost",
    });
  }

  return result;
}

/**
 * Create MatchSnapshot for storing on Bill
 */
export function createMatchSnapshot(result: MatchResult): MatchSnapshot {
  return {
    matchType: result.matchType,
    status: result.status,
    requiresOverride: result.requiresApprovalOverride,
    totalLines: result.lines.length,
    passedLines: result.lines.filter((l) => l.status === MatchStatus.PASS).length,
    warningLines: result.lines.filter((l) => l.status === MatchStatus.WARNING).length,
    failedLines: result.lines.filter((l) => l.status === MatchStatus.FAIL).length,
    billTotalCents: result.totals.billTotal,
    matchedTotalCents: result.totals.grvTotal,
    varianceCents: result.totals.variance,
    linkedPOs: result.lines
      .filter((l) => l.poId)
      .map((l) => ({
        poId: l.poId!,
        poNumber: l.poNumber || "",
      })),
    linkedGRVs: result.lines
      .filter((l) => l.grvId)
      .map((l) => ({
        grvId: l.grvId!,
        grvNumber: l.grvNumber || "",
      })),
    matchedAt: result.matchedAt,
  };
}

/**
 * Generate UI panel data for matching display
 */
export async function getMatchingPanelData(
  billId: string,
  tolerance: MatchTolerance = DEFAULT_MATCH_TOLERANCE
): Promise<MatchingPanelData> {
  const matchResult = await matchBill(billId, tolerance);

  const bill = await SupplierBill.findById(billId)
    .populate("supplierId", "name")
    .populate("grvIds")
    .lean();

  const panel: MatchingPanelData = {
    billId: new Types.ObjectId(billId),
    billNumber: matchResult.billNumber,
    supplierName: (bill?.supplierId as any)?.name || "Unknown",
    matchType: matchResult.matchType,
    status: matchResult.status,
    canApprove: matchResult.status === MatchStatus.PASS,
    requiresOverride: matchResult.requiresApprovalOverride,
    summary: {
      totalLines: matchResult.lines.length,
      matched: matchResult.lines.filter((l) => l.status === MatchStatus.PASS).length,
      warnings: matchResult.lines.filter((l) => l.status === MatchStatus.WARNING).length,
      failed: matchResult.lines.filter((l) => l.status === MatchStatus.FAIL).length,
    },
    amounts: {
      bill: matchResult.totals.billTotal,
      grv: matchResult.totals.grvTotal,
      po: matchResult.totals.poTotal,
      variance: matchResult.totals.variance,
      variancePercent: matchResult.totals.variancePercent,
    },
    lineItems: matchResult.lines.map((line) => ({
      lineNo: line.lineNo,
      itemName: line.itemName,
      billQty: line.billQty,
      receivedQty: line.grvReceivedQty || 0,
      orderedQty: line.poOrderedQty || 0,
      isOverReceived: line.overReceiptQty > 0,
      isUnderReceived: line.unmatchedQty > 0 && line.matchedQty > 0,
      isPriceMismatch: !line.isPriceMatch,
      isNoGRV: !line.grvId,
      messages: line.reasons.map((r) => r.message),
      needsAttention: line.status !== MatchStatus.PASS,
    })),
    grvBreakdown: [],
  };

  // GRV breakdown
  if (bill?.grvIds) {
    const grvs = await GRV.find({ _id: { $in: bill.grvIds } }).lean();
    
    panel.grvBreakdown = grvs.map((grv) => {
      const grvLines = matchResult.lines.filter(
        (l) => l.grvId?.toString() === grv._id.toString()
      );
      
      return {
        grvId: grv._id as Types.ObjectId,
        grvNumber: grv.grvNumber,
        grvDate: grv.receivedAt,
        matchedLines: grvLines.filter((l) => l.status === MatchStatus.PASS).length,
        totalLines: grvLines.length,
        status: grvLines.length === 0 
          ? "NONE" 
          : grvLines.every((l) => l.status === MatchStatus.PASS)
            ? "FULL"
            : "PARTIAL",
      };
    });
  }

  // Override form if needed
  if (matchResult.requiresApprovalOverride) {
    panel.overrideForm = {
      reason: "",
      required: true,
    };
  }

  return panel;
}

/**
 * Check if bill can be approved (after matching)
 */
export async function canApproveBill(
  billId: string,
  tolerance: MatchTolerance = DEFAULT_MATCH_TOLERANCE
): Promise<{ canApprove: boolean; reason?: string }> {
  const result = await matchBill(billId, tolerance);

  if (result.status === MatchStatus.FAIL) {
    return {
      canApprove: false,
      reason: `Matching failed: ${result.reasons.map((r) => r.message).join("; ")}`,
    };
  }

  if (result.requiresApprovalOverride && !tolerance.priceVariancePercent && !tolerance.amountVariancePercent) {
    return {
      canApprove: false,
      reason: "Bill requires approval override but tolerances not configured",
    };
  }

  return { canApprove: true };
}

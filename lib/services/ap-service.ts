/**
 * Accounts Payable Service
 * 
 * Implements:
 * - Supplier Bill Posting (AP Ledger)
 * - Supplier AP Balance tracking
 * - GRV invoiced quantity tracking
 * - Aging reports
 * - Supplier statements
 */

import { dbConnect } from "@/lib/db";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { GRV } from "@/lib/models/GRV";
import { Supplier } from "@/lib/models/Supplier";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { Types } from "mongoose";

import {
  BillType,
  SupplierAPBalance,
  APLedgerEntry,
  BillPostingResult,
  SupplierStatement,
  AgingReport,
  UnpaidBill,
  GRVLineInvoicing,
  GRVInvoicingSummary,
} from "@/lib/types/ap";
import { SupplierBillStatus } from "@/lib/types/p2p-status";
import { logAuditEntry, TransitionResult } from "./p2p-service";
import { AuditAction } from "@/lib/types/p2p-status";

// ============================================================================
// BILL POSTING
// ============================================================================

/**
 * Approve and Post Supplier Bill
 * 
 * Steps:
 * 1. Lock bill (set status to APPROVED)
 * 2. Calculate outstanding amount
 * 3. Update GRV lines with invoiced quantities
 * 4. Create AP ledger entry
 * 5. Update supplier AP balance
 */
export async function approveAndPostBill(
  billId: string,
  userId: string,
  userRole: string,
  override: boolean = false,
  overrideReason?: string
): Promise<BillPostingResult> {
  const result: BillPostingResult = {
    success: false,
    errors: [],
    warnings: [],
    billId: new Types.ObjectId(billId),
    billNumber: "",
    previousStatus: "",
    newStatus: "",
    totalCents: 0,
    outstandingCents: 0,
    grvsUpdated: 0,
    linesInvoiced: 0,
    apEntriesCreated: 0,
    postedAt: new Date(),
  };

  await dbConnect();

  // Get bill
  const bill = await SupplierBill.findById(billId);
  if (!bill) {
    result.errors.push("Bill not found");
    return result;
  }

  result.previousStatus = bill.status;
  result.billNumber = bill.billNumber;
  result.totalCents = bill.totalCents || 0;

  // Validate status
  if (bill.status !== "DRAFT" && bill.status !== "MATCHING_REQUIRED") {
    result.errors.push(`Bill must be in DRAFT or MATCHING_REQUIRED status (current: ${bill.status})`);
    return result;
  }

  // Determine bill type
  const billType = determineBillType(bill);

  // Start transaction
  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Update GRV lines with invoiced quantities (for stock bills)
    if (billType === "STOCK" || billType === "MIXED") {
      const grvUpdateResult = await updateGRVInvoicedQuantities(bill, session);
      result.grvsUpdated = grvUpdateResult.grvsUpdated;
      result.linesInvoiced = grvUpdateResult.linesUpdated;
      result.warnings.push(...grvUpdateResult.warnings);
    }

    // 2. Calculate outstanding
    const outstandingCents = bill.totalCents - (bill.paidCents || 0);
    result.outstandingCents = outstandingCents;

    // 3. Create AP ledger entry
    const apEntry = await createAPLedgerEntry(
      bill,
      "BILL",
      session,
      userId
    );
    result.apEntriesCreated = apEntry ? 1 : 0;

    // 4. Update supplier AP balance
    await updateSupplierAPBalance(bill.supplierId, session);

    // 5. Update bill status
    bill.status = "APPROVED";
    bill.postedAt = new Date();
    bill.postedBy = new Types.ObjectId(userId);
    bill.updatedBy = new Types.ObjectId(userId);
    (bill as any).outstandingCents = outstandingCents;
    (bill as any).billType = billType;
    
    if (override && overrideReason) {
      (bill as any).overrideReason = overrideReason;
      (bill as any).overriddenBy = userId;
      (bill as any).overriddenAt = new Date();
    }

    await bill.save({ session });

    await session.commitTransaction();
    
    result.success = true;
    result.newStatus = "APPROVED";
    result.postedAt = new Date();

    // Audit
    await logAuditEntry({
      docType: "SupplierBill",
      docId: bill._id,
      docNumber: bill.billNumber,
      action: AuditAction.APPROVE,
      userId,
      userRole,
      screen: "SupplierBills",
      override,
      overrideReason,
    });
  } catch (error: any) {
    await session.abortTransaction();
    result.errors.push(`Transaction failed: ${error.message}`);
    return result;
  } finally {
    session.endSession();
  }

  return result;
}

// ============================================================================
// VOID BILL
// ============================================================================

/**
 * Void Bill - reverses AP impact
 */
export async function voidBill(
  billId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<TransitionResult> {
  const result: TransitionResult = {
    success: false,
    error: "Not implemented - use p2p-service.voidBillWithReversal()",
  };

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine bill type (stock vs non-stock)
 */
function determineBillType(bill: any): "STOCK" | "NON_STOCK" | "MIXED" {
  const hasStockLine = bill.billLines?.some(
    (line: any) => line.stockItemId && line.grvId
  );
  const hasNonStockLine = bill.billLines?.some(
    (line: any) => !line.stockItemId || !line.grvId
  );

  if (hasStockLine && hasNonStockLine) return "MIXED";
  if (hasStockLine) return "STOCK";
  return "NON_STOCK";
}

/**
 * Update GRV lines with invoiced quantities
 */
async function updateGRVInvoicedQuantities(
  bill: any,
  session: any
): Promise<{ grvsUpdated: number; linesUpdated: number; warnings: string[] }> {
  const warnings: string[] = [];
  let grvsUpdated = 0;
  let linesUpdated = 0;

  // Group by GRV
  const grvMap = new Map<string, any[]>();
  
  for (const line of bill.billLines || []) {
    if (line.grvId) {
      const grvId = line.grvId.toString();
      if (!grvMap.has(grvId)) {
        grvMap.set(grvId, []);
      }
      grvMap.get(grvId)!.push(line);
    }
  }

  // Update each GRV
  for (const [grvId, lines] of grvMap) {
    const grv = await GRV.findById(grvId).session(session);
    if (!grv) {
      warnings.push(`GRV ${grvId} not found`);
      continue;
    }

    let lineCount = 0;
    for (const billLine of lines) {
      const grvLine = grv.lines?.find(
        (l: any) => l._id?.toString() === billLine.grvLineId?.toString()
      );

      if (grvLine) {
        // Update invoiced qty
        const currentInvoiced = (grvLine as any).invoicedQty || 0;
        (grvLine as any).invoicedQty = currentInvoiced + billLine.quantity;
        lineCount++;
      }
    }

    if (lineCount > 0) {
      await grv.save({ session });
      grvsUpdated++;
      linesUpdated += lineCount;
    }
  }

  return { grvsUpdated, linesUpdated, warnings };
}

/**
 * Create AP ledger entry
 */
async function createAPLedgerEntry(
  bill: any,
  entryType: "BILL" | "PAYMENT" | "ADJUSTMENT" | "VOID",
  session: any,
  userId: string
): Promise<any> {
  // In a full implementation, this would create an AP Ledger collection
  // For now, we store it on the bill as metadata
  
  // Calculate running balance (simplified)
  // In production, would query previous entries
  
  const entry = {
    companyId: bill.companyId,
    supplierId: bill.supplierId,
    entryType,
    documentType: "SupplierBill",
    documentId: bill._id,
    documentNumber: bill.billNumber,
    debitCents: bill.totalCents || 0,
    creditCents: 0,
    balanceCents: bill.totalCents || 0,  // Would be calculated
    documentDate: bill.billDate,
    dueDate: bill.dueDate,
    postedAt: new Date(),
    createdBy: new Types.ObjectId(userId),
    isImmutable: true,
  };

  // Store on bill for now
  (bill as any).apEntry = entry;

  return entry;
}

/**
 * Update supplier AP balance
 */
async function updateSupplierAPBalance(
  supplierId: Types.ObjectId | string,
  session: any
): Promise<void> {
  // Aggregate bills and payments for this supplier
  const pipeline = [
    {
      $match: {
        supplierId: new Types.ObjectId(supplierId as string),
        isDeleted: false,
        status: { $in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
      },
    },
    {
      $group: {
        _id: "$status",
        total: { $sum: "$totalCents" },
        paid: { $sum: "$paidCents" },
      },
    },
  ];

  // This would run against the database
  // For now, just ensure supplier exists
  await Supplier.findById(supplierId).session(session);
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get supplier AP balance
 */
export async function getSupplierAPBalance(
  supplierId: string
): Promise<SupplierAPBalance | null> {
  await dbConnect();

  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier) return null;

  const bills = await SupplierBill.find({
    supplierId,
    isDeleted: false,
    status: { $in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
  }).lean();

  const payments = await SupplierPayment.find({
    supplierId,
    isDeleted: false,
    status: "POSTED",
  }).lean();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let totalBilled = 0;
  let totalPaid = 0;
  let current = 0;
  let days31_60 = 0;
  let days61_90 = 0;
  let over90 = 0;
  let overdueCount = 0;

  for (const bill of bills) {
    const billTotal = bill.totalCents || 0;
    const paid = bill.paidCents || 0;
    const outstanding = billTotal - paid;

    totalBilled += billTotal;
    totalPaid += paid;

    // Aging
    if (bill.dueDate) {
      const dueDate = new Date(bill.dueDate);
      if (dueDate < thirtyDaysAgo) {
        current += outstanding;
      } else if (dueDate < sixtyDaysAgo) {
        days31_60 += outstanding;
      } else if (dueDate < ninetyDaysAgo) {
        days61_90 += outstanding;
      } else {
        over90 += outstanding;
      }

      if (dueDate < now && outstanding > 0) {
        overdueCount++;
      }
    }
  }

  return {
    supplierId: supplier._id as Types.ObjectId,
    supplierName: supplier.name,
    totalBilledCents: totalBilled,
    totalPaidCents: totalPaid,
    outstandingCents: totalBilled - totalPaid,
    draftCents: 0,
    openCents: totalBilled - totalPaid,
    overdueCents: over90,
    totalBills: bills.length,
    unpaidBills: bills.filter((b) => (b.totalCents || 0) > (b.paidCents || 0)).length,
    overdueBills: overdueCount,
    aging: {
      current,
      days31_60,
      days61_90,
      over90,
    },
  };
}

/**
 * Get unpaid bills
 */
export async function getUnpaidBills(
  companyId: string,
  options: {
    supplierId?: string;
    includeOverdueOnly?: boolean;
  } = {}
): Promise<UnpaidBill[]> {
  await dbConnect();

  const query: any = {
    companyId: new Types.ObjectId(companyId),
    isDeleted: false,
    status: { $in: ["APPROVED", "PARTIALLY_PAID"] },
  };

  if (options.supplierId) {
    query.supplierId = new Types.ObjectId(options.supplierId);
  }

  if (options.includeOverdueOnly) {
    query.dueDate = { $lt: new Date() };
  }

  const bills = await SupplierBill.find(query)
    .populate("supplierId", "name")
    .sort({ dueDate: 1 })
    .lean();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return bills.map((bill) => {
    const total = bill.totalCents || 0;
    const paid = bill.paidCents || 0;
    const outstanding = total - paid;

    let daysOverdue = 0;
    let agingBucket: "current" | "days31_60" | "days61_90" | "over90" = "current";

    if (bill.dueDate) {
      const dueDate = new Date(bill.dueDate);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      daysOverdue = Math.max(0, diffDays);

      if (dueDate < thirtyDaysAgo) {
        if (daysOverdue > 90) agingBucket = "over90";
        else if (daysOverdue > 60) agingBucket = "days61_90";
        else if (daysOverdue > 30) agingBucket = "days31_60";
      }
    }

    return {
      billId: bill._id as Types.ObjectId,
      billNumber: bill.billNumber,
      supplierId: bill.supplierId as Types.ObjectId,
      supplierName: (bill.supplierId as any)?.name || "",
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      totalCents: total,
      paidCents: paid,
      outstandingCents: outstanding,
      status: bill.status,
      daysOverdue,
      agingBucket,
    };
  });
}

/**
 * Get aging report
 */
export async function getAgingReport(
  companyId: string
): Promise<AgingReport> {
  const unpaidBills = await getUnpaidBills(companyId);

  const report: AgingReport = {
    companyId: new Types.ObjectId(companyId),
    asOfDate: new Date(),
    totalOutstandingCents: 0,
    aging: {
      current: 0,
      days31_60: 0,
      days61_90: 0,
      over90: 0,
    },
    bySupplier: [],
  };

  // Group by supplier
  const supplierMap = new Map<string, UnpaidBill[]>();
  
  for (const bill of unpaidBills) {
    const key = bill.supplierId.toString();
    if (!supplierMap.has(key)) {
      supplierMap.set(key, []);
    }
    supplierMap.get(key)!.push(bill);
  }

  // Build report
  for (const [supplierId, bills] of supplierMap) {
    const supplierName = bills[0].supplierName;
    let supplierTotal = 0;
    const supplierAging = { current: 0, days31_60: 0, days61_90: 0, over90: 0 };

    for (const bill of bills) {
      supplierTotal += bill.outstandingCents;
      report.totalOutstandingCents += bill.outstandingCents;

      switch (bill.agingBucket) {
        case "current":
          supplierAging.current += bill.outstandingCents;
          report.aging.current += bill.outstandingCents;
          break;
        case "days31_60":
          supplierAging.days31_60 += bill.outstandingCents;
          report.aging.days31_60 += bill.outstandingCents;
          break;
        case "days61_90":
          supplierAging.days61_90 += bill.outstandingCents;
          report.aging.days61_90 += bill.outstandingCents;
          break;
        case "over90":
          supplierAging.over90 += bill.outstandingCents;
          report.aging.over90 += bill.outstandingCents;
          break;
      }
    }

    report.bySupplier.push({
      supplierId: new Types.ObjectId(supplierId),
      supplierName,
      totalOutstandingCents: supplierTotal,
      aging: supplierAging,
      bills: bills.map((b) => ({
        billId: b.billId,
        billNumber: b.billNumber,
        dueDate: b.dueDate,
        amountCents: b.outstandingCents,
        daysOverdue: b.daysOverdue,
      })),
    });
  }

  return report;
}

/**
 * Get supplier statement
 */
export async function getSupplierStatement(
  supplierId: string,
  fromDate: Date,
  toDate: Date
): Promise<SupplierStatement | null> {
  await dbConnect();

  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier) return null;

  // Get bills in period
  const bills = await SupplierBill.find({
    supplierId,
    isDeleted: false,
    billDate: { $gte: fromDate, $lte: toDate },
  }).lean();

  // Get payments in period
  const payments = await SupplierPayment.find({
    supplierId,
    isDeleted: false,
    paymentDate: { $gte: fromDate, $lte: toDate },
  }).lean();

  // Calculate opening balance (bills/payments before period)
  const previousBills = await SupplierBill.aggregate([
    {
      $match: {
        supplierId: new Types.ObjectId(supplierId),
        isDeleted: false,
        billDate: { $lt: fromDate },
        status: { $in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalCents" },
        paid: { $sum: "$paidCents" },
      },
    },
  ]);

  const openingBalance = previousBills[0]
    ? previousBills[0].total - previousBills[0].paid
    : 0;

  // Calculate totals
  const totalBilled = bills.reduce((sum, b) => sum + (b.totalCents || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amountCents || 0), 0);

  return {
    supplierId: supplier._id as Types.ObjectId,
    supplierName: supplier.name,
    fromDate,
    toDate,
    openingBalanceCents: openingBalance,
    bills: bills.map((b) => ({
      billId: b._id as Types.ObjectId,
      billNumber: b.billNumber,
      date: b.billDate,
      dueDate: b.dueDate,
      amountCents: b.totalCents || 0,
      paidCents: b.paidCents || 0,
      outstandingCents: (b.totalCents || 0) - (b.paidCents || 0),
      status: b.status,
    })),
    payments: payments.map((p) => ({
      paymentId: p._id as Types.ObjectId,
      paymentNumber: p.paymentNumber,
      date: p.paymentDate,
      amountCents: p.amountCents || 0,
    })),
    closingBalanceCents: openingBalance + totalBilled - totalPaid,
    totalBilledCents: totalBilled,
    totalPaidCents: totalPaid,
  };
}

/**
 * Get GRV invoicing summary
 */
export async function getGRVInvoicingSummary(
  grvId: string
): Promise<GRVInvoicingSummary | null> {
  await dbConnect();

  const grv = await GRV.findById(grvId)
    .populate("supplierId", "name")
    .lean();

  if (!grv) return null;

  let totalReceived = 0;
  let totalInvoiced = 0;
  let fullyInvoiced = 0;
  let partiallyInvoiced = 0;

  for (const line of grv.lines || []) {
    const received = line.receivedQty || 0;
    const invoiced = (line as any).invoicedQty || 0;

    totalReceived += received * (line.unitCostCents || 0);
    totalInvoiced += invoiced * (line.unitCostCents || 0);

    if (invoiced >= received && received > 0) {
      fullyInvoiced++;
    } else if (invoiced > 0) {
      partiallyInvoiced++;
    }
  }

  const totalLines = grv.lines?.length || 0;

  return {
    grvId: grv._id as Types.ObjectId,
    grvNumber: grv.grvNumber,
    grvDate: grv.receivedAt,
    supplierName: (grv.supplierId as any)?.name || "",
    totalReceivedCents: totalReceived,
    totalInvoicedCents: totalInvoiced,
    remainingCents: totalReceived - totalInvoiced,
    lineCount: totalLines,
    fullyInvoicedLines: fullyInvoiced,
    partiallyInvoicedLines: partiallyInvoiced,
    uninvoicedLines: totalLines - fullyInvoiced - partiallyInvoiced,
    status:
      fullyInvoiced === totalLines
        ? "FULL"
        : partiallyInvoiced > 0 || fullyInvoiced > 0
        ? "PARTIAL"
        : "NONE",
  };
}

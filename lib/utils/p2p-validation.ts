/**
 * Procure-to-Pay Validation Utilities
 * 
 * This module provides validation functions to enforce the canonical
 * relationships between P2P documents:
 * 
 * - Prevent cross-supplier linking (CRITICAL)
 * - Validate document state transitions
 * - Check quantity constraints
 * - Validate allocations
 */

import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { Supplier } from "@/lib/models/Supplier";
import type {
  ValidateGRVtoPOResult,
  ValidateBillToGRVsResult,
  ValidatePaymentToBillsResult,
  RelationshipValidationResult,
} from "@/lib/types/p2p";

// ============================================================================
// CROSS-SUPPLIER VALIDATION (CRITICAL)
// ============================================================================

/**
 * Validates that a document's supplier matches all linked documents' suppliers
 * This is the CRITICAL rule that prevents cross-supplier linking
 */
export async function validateSupplierConsistency(
  mainSupplierId: Types.ObjectId | string,
  linkedSupplierIds: Array<Types.ObjectId | string>
): Promise<RelationshipValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const mainId = mainSupplierId.toString();
  
  // Check each linked document's supplier
  for (const supplierId of linkedSupplierIds) {
    if (supplierId && supplierId.toString() !== mainId) {
      errors.push(
        `Cross-supplier linking detected: Cannot link documents from different suppliers`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Fetches and validates supplier for a document
 */
export async function getSupplierForDocument(
  supplierId: Types.ObjectId | string
): Promise<{ id: Types.ObjectId; name: string } | null> {
  await dbConnect();
  
  const supplier = await Supplier.findById(supplierId)
    .select("name")
    .lean();
    
  if (!supplier) return null;
  
  return {
    id: supplier._id as Types.ObjectId,
    name: supplier.name,
  };
}

// ============================================================================
// GRV TO PO VALIDATION
// ============================================================================

/**
 * Validates that a GRV can be linked to a PO
 * Rules:
 * - GRV supplier must match PO supplier
 * - GRV line quantities cannot exceed PO line quantities
 * - PO must be in valid state (Issued, PartiallyReceived)
 */
export async function validateGRVToPO(
  grvId: Types.ObjectId | string,
  poId: Types.ObjectId | string
): Promise<ValidateGRVtoPOResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  await dbConnect();
  
  // Fetch GRV
  const grv = await GRV.findById(grvId)
    .populate("supplierId", "name")
    .lean();
    
  if (!grv) {
    errors.push("GRV not found");
    return { valid: false, errors, warnings };
  }
  
  // Fetch PO
  const po = await PurchaseOrder.findById(poId)
    .populate("supplierId", "name")
    .lean();
    
  if (!po) {
    errors.push("Purchase Order not found");
    return { valid: false, errors, warnings };
  }
  
  // Rule 1: Supplier must match
  const grvSupplierId = (grv.supplierId as any)?._id || grv.supplierId;
  const poSupplierId = (po.supplierId as any)?._id || po.supplierId;
  
  if (grvSupplierId?.toString() !== poSupplierId?.toString()) {
    errors.push(
      `Supplier mismatch: GRV is for "${(grv.supplierId as any)?.name}" but PO is for "${(po.supplierId as any)?.name}"`
    );
  }
  
  // Rule 2: PO must be in valid state (check against database status values)
  // Database statuses: DRAFT, SUBMITTED, APPROVED, SENT, PARTIALLY_RECEIVED, FULLY_RECEIVED, CLOSED, CANCELLED
  const validPOStatuses = ["SENT", "PARTIALLY_RECEIVED", "APPROVED", "SUBMITTED", "DRAFT"];
  if (!validPOStatuses.includes(po.status)) {
    errors.push(
      `PO status must allow receiving (Issued/Approved/Submitted/Draft), current status: ${po.status}`
    );
  }
  
  // Rule 3: Validate line quantities
  const lineErrors: Array<{ lineNo: number; issue: string }> = [];
  
  if (grv.lines && po.lines) {
    for (const grvLine of grv.lines) {
      const poLine = po.lines.find(
        (l: any) => l.stockItemId?.toString() === grvLine.stockItemId?.toString()
      );
      
      if (poLine) {
        const totalReceived = (poLine.receivedQty || 0) + (grvLine.receivedQty || 0);
        if (totalReceived > poLine.orderedQty) {
          lineErrors.push({
            lineNo: grvLine.lineNo,
            issue: `Received quantity (${totalReceived}) exceeds ordered quantity (${poLine.orderedQty})`,
          });
        }
      } else if (po.lines.length > 0) {
        // Warning: GRV line doesn't match any PO line
        warnings.push(
          `Line ${grvLine.lineNo}: Stock item not found in PO - will be treated as non-PO receipt`
        );
      }
    }
  }
  
  if (lineErrors.length > 0) {
    errors.push(...lineErrors.map((e) => `Line ${e.lineNo}: ${e.issue}`));
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    poSupplierId: poSupplierId as Types.ObjectId,
    grvSupplierId: grvSupplierId as Types.ObjectId,
    lineErrors,
  };
}

// ============================================================================
// BILL TO GRV VALIDATION (CRITICAL - Cross-Supplier)
// ============================================================================

/**
 * Validates that a Supplier Bill can be linked to GRVs
 * CRITICAL: All GRVs must have the SAME supplier as the bill
 * CRITICAL: All GRVs must be Posted (not Draft or Cancelled)
 */
export async function validateBillToGRVs(
  billSupplierId: Types.ObjectId | string,
  grvIds: Array<Types.ObjectId | string>
): Promise<ValidateBillToGRVsResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!grvIds || grvIds.length === 0) {
    return { valid: true, errors, warnings };
  }
  
  await dbConnect();
  
  const billSupplierIdStr = billSupplierId.toString();
  
  // Fetch all GRVs
  const grvs = await GRV.find({ _id: { $in: grvIds } })
    .populate("supplierId", "name")
    .lean();
    
  if (grvs.length !== grvIds.length) {
    errors.push("One or more GRVs not found");
    return { valid: false, errors, warnings };
  }
  
  const grvSuppliers: ValidateBillToGRVsResult["grvSuppliers"] = [];
  
  for (const grv of grvs) {
    const grvSupplierId = (grv.supplierId as any)?._id || grv.supplierId;
    
    grvSuppliers.push({
      grvId: grv._id as Types.ObjectId,
      grvNumber: grv.grvNumber,
      supplierId: grvSupplierId as Types.ObjectId,
      status: grv.status,
    });
    
    // CRITICAL: Check supplier match
    if (grvSupplierId?.toString() !== billSupplierIdStr) {
      const grvSupplierName = (grv.supplierId as any)?.name || "Unknown";
      errors.push(
        `Cross-supplier linking detected: GRV ${grv.grvNumber} is from supplier "${grvSupplierName}" but Bill is for a different supplier`
      );
    }
    
    // GRV must be Posted
    if (grv.status !== "POSTED") {
      errors.push(
        `GRV ${grv.grvNumber} must be Posted before it can be included in a Bill, current status: ${grv.status}`
      );
    }
  }
  
  // Check for duplicate GRVs
  const uniqueGrvIds = new Set(grvIds.map((id) => id.toString()));
  if (uniqueGrvIds.size !== grvIds.length) {
    errors.push("Duplicate GRVs detected in bill");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    grvSuppliers,
    billSupplierId: billSupplierId as Types.ObjectId,
  };
}

// ============================================================================
// PAYMENT TO BILLS VALIDATION (CRITICAL - Cross-Supplier)
// ============================================================================

/**
 * Validates that a Supplier Payment can be allocated to Bills
 * CRITICAL: All Bills must have the SAME supplier as the payment
 * CRITICAL: All Bills must be Posted (not Draft or Voided)
 * CRITICAL: Cannot allocate more than the payment amount
 * CRITICAL: Cannot allocate more than bill outstanding amount
 */
export async function validatePaymentToBills(
  paymentSupplierId: Types.ObjectId | string,
  paymentAmountCents: number,
  allocations: Array<{
    billId: Types.ObjectId | string;
    amountCents: number;
  }>
): Promise<ValidatePaymentToBillsResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!allocations || allocations.length === 0) {
    // No allocations - this is allowed (unapplied payment)
    return { valid: true, errors, warnings };
  }
  
  await dbConnect();
  
  const paymentSupplierIdStr = paymentSupplierId.toString();
  
  // Fetch all Bills
  const billIds = allocations.map((a) => a.billId);
  const bills = await SupplierBill.find({ _id: { $in: billIds } })
    .populate("supplierId", "name")
    .lean();
    
  if (bills.length !== billIds.length) {
    errors.push("One or more Bills not found");
    return { valid: false, errors, warnings };
  }
  
  const billSuppliers: ValidatePaymentToBillsResult["billSuppliers"] = [];
  let totalAllocationCents = 0;
  
  for (const allocation of allocations) {
    const bill = bills.find((b) => b._id.toString() === allocation.billId.toString());
    
    if (!bill) continue;
    
    const billSupplierId = (bill.supplierId as any)?._id || bill.supplierId;
    const outstandingCents = bill.totalCents - (bill.paidCents || 0);
    
    billSuppliers.push({
      billId: bill._id as Types.ObjectId,
      billNumber: bill.billNumber,
      supplierId: billSupplierId as Types.ObjectId,
      status: bill.status,
      outstandingCents,
    });
    
    // CRITICAL: Check supplier match
    if (billSupplierId?.toString() !== paymentSupplierIdStr) {
      const billSupplierName = (bill.supplierId as any)?.name || "Unknown";
      errors.push(
        `Cross-supplier linking detected: Bill ${bill.billNumber} is from supplier "${billSupplierName}" but Payment is for a different supplier`
      );
    }
    
    // Bill must be Posted
    const validBillStatuses = ["Posted", "PartiallyPaid"];
    if (!validBillStatuses.includes(bill.status)) {
      errors.push(
        `Bill ${bill.billNumber} must be Posted before payment can be allocated, current status: ${bill.status}`
      );
    }
    
    // Cannot allocate more than bill outstanding
    if (allocation.amountCents > outstandingCents) {
      errors.push(
        `Allocation to Bill ${bill.billNumber} (${allocation.amountCents}) exceeds outstanding amount (${outstandingCents})`
      );
    }
    
    totalAllocationCents += allocation.amountCents;
  }
  
  // Cannot allocate more than payment amount
  if (totalAllocationCents > paymentAmountCents) {
    errors.push(
      `Total allocations (${totalAllocationCents}) exceed payment amount (${paymentAmountCents})`
    );
  }
  
  // Warning if payment is not fully allocated
  if (totalAllocationCents < paymentAmountCents) {
    warnings.push(
      `Payment has ${paymentAmountCents - totalAllocationCents} cents unallocated`
    );
  }
  
  // Check for duplicate bills
  const uniqueBillIds = new Set(billIds.map((id) => id.toString()));
  if (uniqueBillIds.size !== billIds.length) {
    errors.push("Duplicate Bills detected in payment allocations");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    billSuppliers,
    paymentSupplierId: paymentSupplierId as Types.ObjectId,
    totalAllocationCents,
    paymentAmountCents,
  };
}

// ============================================================================
// DOCUMENT STATE VALIDATION
// ============================================================================

/**
 * Validates if a document can be modified based on its status
 */
export function canModifyDocument(
  status: string,
  allowedStatuses: string[]
): RelationshipValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!allowedStatuses.includes(status)) {
    errors.push(
      `Cannot modify document with status "${status}". Allowed statuses: ${allowedStatuses.join(", ")}`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates if a document can be cancelled
 */
export function canCancelDocument(
  status: string,
  hasLinkedDocuments: boolean = false
): RelationshipValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const cancellableStatuses = ["Draft", "Issued"];
  if (!cancellableStatuses.includes(status)) {
    errors.push(
      `Cannot cancel document with status "${status}"`
    );
  }
  
  if (hasLinkedDocuments) {
    warnings.push(
      "This document has linked documents. Cancelling may require reversing those documents."
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// STOCK ITEM TRACEABILITY
// ============================================================================

/**
 * Gets the full traceability path for a stock item
 * Returns: GRV → PO (optional), Bills, Payments
 */
export async function getStockItemTrace(
  stockItemId: Types.ObjectId | string
): Promise<{
  receipts: Array<any>;
  bills: Array<any>;
  payments: Array<any>;
}> {
  await dbConnect();
  
  // Find GRVs containing this stock item
  const grvs = await GRV.find({
    "lines.stockItemId": stockItemId,
    status: "Posted",
    isDeleted: false,
  })
    .populate("poId", "poNumber")
    .populate("supplierId", "name")
    .sort({ receivedAt: -1 })
    .lean();
    
  const receipts = grvs.map((grv) => {
    const line = grv.lines?.find(
      (l: any) => l.stockItemId?.toString() === stockItemId.toString()
    );
    return {
      grvId: grv._id,
      grvNumber: grv.grvNumber,
      grvDate: grv.receivedAt,
      poId: grv.poId?._id,
      poNumber: (grv.poId as any)?.poNumber,
      supplierId: grv.supplierId?._id,
      supplierName: (grv.supplierId as any)?.name,
      quantity: line?.receivedQty || 0,
      unitCostCents: line?.unitCostCents || 0,
    };
  });
  
  // Find Bills containing this stock item
  const bills = await SupplierBill.find({
    "billLines.stockItemId": stockItemId,
    status: { $in: ["Posted", "PartiallyPaid", "Paid"] },
    isDeleted: false,
  })
    .populate("supplierId", "name")
    .sort({ billDate: -1 })
    .lean();
    
  const billData = bills.map((bill) => {
    const line = bill.billLines?.find(
      (l: any) => l.stockItemId?.toString() === stockItemId.toString()
    );
    return {
      billId: bill._id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      supplierId: bill.supplierId?._id,
      supplierName: (bill.supplierId as any)?.name,
      quantity: line?.quantity || 0,
      unitCostCents: line?.unitCostCents || 0,
    };
  });
  
  // Find Payments linked to those bills
  const billIds = bills.map((b: any) => b._id);
  const payments = await SupplierPayment.find({
    "allocations.billId": { $in: billIds },
    status: "Posted",
    isDeleted: false,
  })
    .populate("supplierId", "name")
    .sort({ paymentDate: -1 })
    .lean();
    
  const paymentData = payments.map((payment: any) => {
    // Filter allocations to relevant bills
    const relevantAllocations = payment.allocations?.filter(
      (alloc: any) => billIds.some((bid: any) => bid.toString() === alloc.supplierBillId?.toString())
    );
    const totalAllocated = relevantAllocations?.reduce(
      (sum: number, alloc: any) => sum + (alloc.amountCents || 0),
      0
    ) || 0;
    
    return {
      paymentId: payment._id,
      paymentNumber: payment.paymentNumber,
      paymentDate: payment.paymentDate,
      supplierId: payment.supplierId?._id,
      supplierName: (payment.supplierId as any)?.name,
      amountCents: totalAllocated,
    };
  });
  
  return {
    receipts,
    bills: billData,
    payments: paymentData,
  };
}

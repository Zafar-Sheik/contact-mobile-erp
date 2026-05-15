/**
 * Procure-to-Pay Validation Utilities
 * 
 * This module provides validation functions to enforce the canonical
 * relationships between P2P documents:
 * 
 * - Prevent cross-supplier linking (CRITICAL)
 * - Validate document state transitions
 * - Check quantity constraints
 */

import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { Supplier } from "@/lib/models/Supplier";
import type {
  ValidateGRVtoPOResult,
  ValidateBillToGRVsResult,
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
  
  for (const supplierId of linkedSupplierIds) {
    if (supplierId && supplierId.toString() !== mainId) {
      errors.push(
        `Cross-supplier linking detected: Cannot link documents from different suppliers`
      );
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
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
  
  return { id: supplier._id as Types.ObjectId, name: supplier.name };
}

// ============================================================================
// GRV TO PO VALIDATION
// ============================================================================

/**
 * Validates that a GRV can be linked to a PO
 */
export async function validateGRVToPO(
  grvId: Types.ObjectId | string,
  poId: Types.ObjectId | string
): Promise<ValidateGRVtoPOResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  await dbConnect();
  
  const grv = await GRV.findById(grvId)
    .populate("supplierId", "name")
    .lean();
    
  if (!grv) {
    errors.push("GRV not found");
    return { valid: false, errors, warnings };
  }
  
  const po = await PurchaseOrder.findById(poId)
    .populate("supplierId", "name")
    .lean();
    
  if (!po) {
    errors.push("Purchase Order not found");
    return { valid: false, errors, warnings };
  }
  
  const grvSupplierId = (grv.supplierId as any)?._id || grv.supplierId;
  const poSupplierId = (po.supplierId as any)?._id || po.supplierId;
  
  if (grvSupplierId?.toString() !== poSupplierId?.toString()) {
    errors.push(
      `Supplier mismatch: GRV is for "${(grv.supplierId as any)?.name}" but PO is for "${(po.supplierId as any)?.name}"`
    );
  }
  
  const validPOStatuses = ["SENT", "PARTIALLY_RECEIVED", "APPROVED", "SUBMITTED", "DRAFT"];
  if (!validPOStatuses.includes(po.status)) {
    errors.push(
      `PO status must allow receiving, current status: ${po.status}`
    );
  }
  
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
    
    if (grvSupplierId?.toString() !== billSupplierIdStr) {
      const grvSupplierName = (grv.supplierId as any)?.name || "Unknown";
      errors.push(
        `Cross-supplier linking detected: GRV ${grv.grvNumber} is from supplier "${grvSupplierName}"`
      );
    }
    
    if (grv.status !== "POSTED") {
      errors.push(
        `GRV ${grv.grvNumber} must be Posted, current status: ${grv.status}`
      );
    }
  }
  
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
  
  return { valid: errors.length === 0, errors, warnings };
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
    errors.push(`Cannot cancel document with status "${status}"`);
  }
  
  if (hasLinkedDocuments) {
    warnings.push(
      "This document has linked documents. Cancelling may require reversing those documents."
    );
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// STOCK ITEM TRACEABILITY
// ============================================================================

/**
 * Gets the full traceability path for a stock item
 * Returns: GRV → PO (optional), Bills
 */
export async function getStockItemTrace(
  stockItemId: Types.ObjectId | string
): Promise<{
  receipts: Array<any>;
  bills: Array<any>;
}> {
  await dbConnect();
  
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
  
  return { receipts, bills: billData };
}

/**
 * Procure-to-Pay (P2P) Shared Types
 * 
 * This module defines the canonical relationships and shared interfaces
 * for the Procure-to-Pay workflow:
 * 
 * Supplier → PO → GRV → SupplierBill → SupplierPayment
 * 
 * Document Flow:
 * 1. Purchase Order (PO) - Order placed with supplier
 * 2. Goods Received Voucher (GRV) - Receipt of goods (can link to PO)
 * 3. Supplier Bill (Supplier Invoice) - Invoice from supplier (links to GRVs)
 * 4. Supplier Payment - Payment made to supplier (applies to Bills)
 */

import { Types } from "mongoose";

// ============================================================================
// SHARED DOCUMENT INTERFACE
// All P2P documents share these common fields
// ============================================================================

/** Common fields shared across all P2P documents */
export interface P2PDocumentHeader {
  // Identification
  _id: Types.ObjectId;
  documentNumber: string;  // Human-readable: PO-000123, GRV-000456, BILL-000789, PAY-000321
  
  // Company & Supplier
  companyId: Types.ObjectId;
  supplierId: Types.ObjectId;
  supplierName?: string;  // Populated reference
  
  // Status
  status: P2PStatus;
  
  // Dates
  documentDate: Date;
  dueDate?: Date;
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Audit
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  
  // Financial
  subtotalCents: number;
  vatCents: number;
  discountCents: number;
  totalCents: number;
  
  // Notes
  notes?: string;
}

// ============================================================================
// STATUS DEFINITIONS
// ============================================================================

export type POStatus = "Draft" | "Issued" | "PartiallyReceived" | "FullyReceived" | "Closed" | "Cancelled";
export type GRVStatus = "Draft" | "Posted" | "Cancelled";
export type SupplierBillStatus = "Draft" | "Posted" | "PartiallyPaid" | "Paid" | "Voided";
export type SupplierPaymentStatus = "Draft" | "Posted" | "Reversed";

export type P2PStatus = POStatus | GRVStatus | SupplierBillStatus | SupplierPaymentStatus;

// ============================================================================
// PURCHASE ORDER TYPES
// ============================================================================

export interface POLine {
  _id?: Types.ObjectId;
  lineNo: number;
  stockItemId: Types.ObjectId;
  stockItemSnapshot?: StockItemSnapshot;
  description: string;
  
  // Quantities
  orderedQty: number;
  receivedQty: number;  // Track received quantity
  
  // Pricing
  unitCostCents: number;
  subtotalCents: number;
  
  // Optional PO line reference (for linking to GRV lines)
  grvLineIds?: Types.ObjectId[];
}

export interface PurchaseOrder extends P2PDocumentHeader {
  documentNumber: string;  // poNumber
  poNumber: string;  // Alias for documentNumber
  status: POStatus;
  
  // References
  expectedAt?: Date;
  issuedAt?: Date;
  
  // Lines
  lines: POLine[];
  
  // Override totals
  subtotalCents: number;
  totalCents: number;
}

// ============================================================================
// GOODS RECEIVED VOUCHER (GRV) TYPES
// ============================================================================

export interface GRVLine {
  _id?: Types.ObjectId;
  lineNo: number;
  stockItemId: Types.ObjectId;
  stockItemSnapshot?: StockItemSnapshot;
  
  // Quantities
  orderedQty: number;  // From PO
  receivedQty: number;
  
  // Pricing
  unitCostCents: number;
  discountType: "none" | "percent" | "amount";
  discountValue: number;
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
  
  // PO Line reference (optional)
  poLineId?: Types.ObjectId;
  
  // Tracking
  batchNumber?: string;
  expiryDate?: Date;
  serialNumbers?: string[];
  
  // Variance
  varianceReason?: "none" | "damaged" | "short_delivery" | "wrong_item" | "free_stock" | "other";
  remarks?: string;
}

export interface GoodsReceivedVoucher extends P2PDocumentHeader {
  documentNumber: string;  // grvNumber
  grvNumber: string;  // Alias for documentNumber
  status: GRVStatus;
  
  // References
  poId?: Types.ObjectId;
  poNumber?: string;  // Populated reference
  
  // Reference info
  referenceType?: "none" | "po" | "supplier_invoice" | "delivery_note";
  referenceNumber?: string;
  
  // Location
  locationId?: string;
  locationName?: string;
  
  // Dates
  receivedAt: Date;
  postedAt?: Date;
  
  // Lines
  lines: GRVLine[];
  
  // Totals
  subtotalCents: number;
  vatTotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
}

// ============================================================================
// SUPPLIER BILL TYPES
// ============================================================================

export interface SupplierBillLine {
  _id?: Types.ObjectId;
  lineNo: number;
  stockItemId: Types.ObjectId;
  stockItemSnapshot?: StockItemSnapshot;
  
  description: string;
  quantity: number;
  
  unitCostCents: number;
  vatRate: number;
  vatCents: number;
  subtotalCents: number;
  
  // Source document references
  grvId?: Types.ObjectId;
  grvNumber?: string;  // Populated reference
  poLineId?: Types.ObjectId;
}

export interface SupplierBill extends P2PDocumentHeader {
  documentNumber: string;  // billNumber
  billNumber: string;  // Alias for documentNumber
  status: SupplierBillStatus;
  
  // References
  poId?: Types.ObjectId;
  poNumber?: string;  // Populated reference
  grvIds: Types.ObjectId[];  // Array of GRVs linked to this bill
  
  // Reference (supplier's invoice number)
  reference?: string;
  
  // Dates
  billDate: Date;
  dueDate?: Date;
  postedAt?: Date;
  voidedAt?: Date;
  
  // Financial
  subtotalCents: number;
  vatCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  
  // Lines
  billLines: SupplierBillLine[];
}

// ============================================================================
// SUPPLIER PAYMENT TYPES
// ============================================================================

export interface SupplierPaymentAllocation {
  supplierBillId: Types.ObjectId;
  billNumber?: string;  // Populated reference
  amountCents: number;
}

export interface SupplierPayment extends P2PDocumentHeader {
  documentNumber: string;  // paymentNumber
  paymentNumber: string;  // Alias for documentNumber
  status: SupplierPaymentStatus;
  
  // References - Payment always belongs to ONE supplier
  supplierId: Types.ObjectId;
  
  // Payment details
  paymentDate: Date;
  method: "Cash" | "EFT" | "Card" | "Cheque" | "Other";
  reference?: string;
  amountCents: number;
  
  // Allocations - Can apply to multiple bills (all must be same supplier)
  allocations: SupplierPaymentAllocation[];
  unallocatedCents: number;
  
  // Status dates
  postedAt?: Date;
  reversedAt?: Date;
}

// ============================================================================
// STOCK ITEM SNAPSHOT
// Captures stock item state at time of transaction for audit trail
// ============================================================================

export interface StockItemSnapshot {
  sku: string;
  name: string;
  unit: string;
  vatRate: number;
  isVatExempt: boolean;
}

// ============================================================================
// RELATIONSHIP VALIDATION
// ============================================================================

/**
 * Validation result for entity relationships
 */
export interface RelationshipValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check if a GRV can be linked to a PO
 * Rules:
 * - GRV must have same supplier as PO
 * - GRV quantities cannot exceed PO quantities (for linked lines)
 */
export interface ValidateGRVtoPOResult extends RelationshipValidationResult {
  poSupplierId?: Types.ObjectId;
  grvSupplierId?: Types.ObjectId;
  lineErrors?: Array<{
    lineNo: number;
    issue: string;
  }>;
}

/**
 * Check if a Supplier Bill can be linked to GRVs
 * Rules:
 * - All GRVs must have same supplier as bill
 * - GRVs must be Posted (not Draft or Cancelled)
 * - Cannot link GRVs from different suppliers (CRITICAL)
 */
export interface ValidateBillToGRVsResult extends RelationshipValidationResult {
  grvSuppliers?: Array<{
    grvId: Types.ObjectId;
    grvNumber: string;
    supplierId: Types.ObjectId;
    status: GRVStatus;
  }>;
  billSupplierId?: Types.ObjectId;
}

/**
 * Check if a Supplier Payment can be linked to Bills
 * Rules:
 * - All Bills must have same supplier as payment
 * - Bills must be Posted (not Draft or Voided)
 * - Cannot link Bills from different suppliers (CRITICAL)
 * - Cannot over-allocate (payment amount vs bill outstanding)
 */
export interface ValidatePaymentToBillsResult extends RelationshipValidationResult {
  billSuppliers?: Array<{
    billId: Types.ObjectId;
    billNumber: string;
    supplierId: Types.ObjectId;
    status: SupplierBillStatus;
    outstandingCents: number;
  }>;
  paymentSupplierId?: Types.ObjectId;
  totalAllocationCents?: number;
  paymentAmountCents?: number;
}

// ============================================================================
// TRACEABILITY TYPES
// ============================================================================

/**
 * Traceability path from StockItem to Payment
 */
export interface StockItemTrace {
  stockItemId: Types.ObjectId;
  stockItemName: string;
  sku: string;
  
  // Receipt path
  receipts: Array<{
    grvId: Types.ObjectId;
    grvNumber: string;
    grvDate: Date;
    poId?: Types.ObjectId;
    poNumber?: string;
    quantity: number;
    unitCostCents: number;
  }>;
  
  // Billing path
  bills: Array<{
    billId: Types.ObjectId;
    billNumber: string;
    billDate: Date;
    quantity: number;
    unitCostCents: number;
  }>;
  
  // Payment path
  payments: Array<{
    paymentId: Types.ObjectId;
    paymentNumber: string;
    paymentDate: Date;
    amountCents: number;
  }>;
}

/**
 * Simplified trace for UI display
 */
export interface TraceableDocument {
  type: "GRV" | "PO" | "Bill" | "Payment";
  id: Types.ObjectId;
  number: string;
  date: Date;
  status: P2PStatus;
  supplierName?: string;
  totalCents: number;
}

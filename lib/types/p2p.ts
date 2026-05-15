/**
 * Procure-to-Pay (P2P) Shared Types
 * 
 * This module defines the canonical relationships and shared interfaces
 * for the Procure-to-Pay workflow:
 * 
 * Supplier → PO → GRV → SupplierBill
 * 
 * Document Flow:
 * 1. Purchase Order (PO) - Order placed with supplier
 * 2. Goods Received Voucher (GRV) - Receipt of goods (can link to PO)
 * 3. Supplier Bill (Supplier Invoice) - Invoice from supplier (links to GRVs)
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
  documentNumber: string;  // Human-readable: PO-000123, GRV-000456, BILL-000789
  
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

export type P2PStatus = POStatus | GRVStatus | SupplierBillStatus;

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
 * Simplified trace for UI display
 */
export interface TraceableDocument {
  type: "GRV" | "PO" | "Bill";
  id: Types.ObjectId;
  number: string;
  date: Date;
  status: P2PStatus;
  supplierName?: string;
  totalCents: number;
}

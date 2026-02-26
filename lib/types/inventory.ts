/**
 * Inventory Transaction Types
 * 
 * Implements immutable inventory ledger with:
 * - PURCHASE_RECEIPT transactions
 * - GRNI (Goods Received Not Invoiced) accrual tracking
 * - Receipt tolerance validation
 */

import { Types } from "mongoose";

// ============================================================================
// INVENTORY TRANSACTION TYPES
// ============================================================================

/** Inventory transaction types */
export enum InventoryTransactionType {
  PURCHASE_RECEIPT = "PURCHASE_RECEIPT",
  PURCHASE_REVERSAL = "PURCHASE_REVERSAL",
  SALES_ISSUE = "SALES_ISSUE",
  SALES_REVERSAL = "SALES_REVERSAL",
  ADJUSTMENT = "ADJUSTMENT",
  TRANSFER = "TRANSFER",
}

/** GRNI status */
export enum GRNIStatus {
  OPEN = "OPEN",
  PARTIALLY_INVOICED = "PARTIALLY_INVOICED",
  FULLY_INVOICED = "FULLY_INVOICED",
  REVERSED = "REVERSED",
}

// ============================================================================
// RECEIPT TOLERANCE SETTINGS
// ============================================================================

/** Receipt tolerance configuration */
export interface ReceiptTolerance {
  // Allow over-receipt by percentage (e.g., 10 = 10%)
  overReceiptPercent: number;
  // Allow over-receipt by absolute quantity
  overReceiptAbsolute: number;
  // Allow under-receipt (negative = not allowed)
  underReceiptPercent: number;
  // Require approval for over-receipt
  requireApprovalForOver: boolean;
}

/** Default tolerance settings */
export const DEFAULT_RECEIPT_TOLERANCE: ReceiptTolerance = {
  overReceiptPercent: 0,
  overReceiptAbsolute: 0,
  underReceiptPercent: 0,
  requireApprovalForOver: false,
};

// ============================================================================
// GRNI (GOODS RECEIVED NOT INVOICED) TRACKING
// ============================================================================

/**
 * GRNI Entry - tracks goods received but not yet invoiced
 * This is an accrual representation (to be mapped to GL later)
 */
export interface GRNIEntry {
  _id?: Types.ObjectId;
  
  // Company & Supplier
  companyId: Types.ObjectId;
  supplierId: Types.ObjectId;
  
  // GRV Reference
  grvId: Types.ObjectId;
  grvNumber: string;
  grvDate: Date;
  
  // PO Reference (if linked)
  poId?: Types.ObjectId;
  poNumber?: string;
  
  // Bill Reference (when invoiced)
  billId?: Types.ObjectId;
  billNumber?: string;
  billDate?: Date;
  
  // Status
  status: GRNIStatus;
  
  // Amounts (in cents)
  grvTotalCents: number;  // Original GRV total
  invoicedCents: number;  // Amount matched to bill
  remainingCents: number;  // Still awaiting invoice
  
  // Line details
  lineCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// VALIDATION RESULT
// ============================================================================

export interface ReceiptValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiresApproval: boolean;
  lines: Array<{
    lineNo: number;
    stockItemId: Types.ObjectId;
    orderedQty: number;
    receivedQty: number;
    previousReceivedQty: number;
    remainingQty: number;
    overReceipt: number;
    isOverTolerance: boolean;
    isUnderTolerance: boolean;
  }>;
}

// ============================================================================
// STOCK ITEM INVENTORY STATE
// ============================================================================

/** Current inventory state for a stock item */
export interface StockItemInventory {
  stockItemId: Types.ObjectId;
  locationId: string;
  
  // Quantities
  onHand: number;
  available: number;
  allocated: number;
  onOrder: number;
  
  // Value
  averageCostCents: number;
  totalValueCents: number;
  
  // Last transaction
  lastMovementDate?: Date;
  lastMovementType?: string;
}

// ============================================================================
// INVENTORY LEDGER ENTRY (Immutable)
// ============================================================================

/**
 * Immutable inventory ledger entry
 */
export interface InventoryLedgerEntry {
  _id: Types.ObjectId;
  
  // Company
  companyId: Types.ObjectId;
  
  // Transaction
  transactionType: InventoryTransactionType;
  transactionId: Types.ObjectId;
  transactionNumber: string;
  transactionDate: Date;
  
  // Stock Item
  stockItemId: Types.ObjectId;
  sku: string;
  itemName: string;
  
  // Location
  locationId: string;
  locationName: string;
  
  // Quantities (immutable - always positive, direction indicated by type)
  quantity: number;  // Always positive, IN or OUT direction
  direction: "IN" | "OUT";
  
  // Values
  unitCostCents: number;
  lineTotalCents: number;
  
  // Running balance (snapshot at time of transaction)
  quantityBefore: number;
  quantityAfter: number;
  valueBeforeCents: number;
  valueAfterCents: number;
  
  // Reference
  referenceType: "GRV" | "SALE" | "ADJUSTMENT";
  referenceId: Types.ObjectId;
  referenceNumber: string;
  
  // Source document line
  sourceLineId?: Types.ObjectId;
  
  // PO link (for tracing)
  poId?: Types.ObjectId;
  poNumber?: string;
  
  // Batch/Serial
  batchNumber?: string;
  serialNumbers?: string[];
  expiryDate?: Date;
  
  // User
  createdBy: Types.ObjectId;
  createdAt: Date;
  
  // Immutable flag
  isImmutable: boolean;
}

// ============================================================================
// POST RESULT
// ============================================================================

export interface PostGRVResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  
  // Inventory updates
  inventoryMovementsCreated: number;
  ledgerEntriesCreated: number;
  
  // PO updates
  poUpdated: boolean;
  poStatusChanged: string;
  
  // GRNI
  grniCreated: boolean;
  grniId?: Types.ObjectId;
  
  // Transactions
  postedAt: Date;
}

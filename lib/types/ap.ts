/**
 * Accounts Payable (AP) Types
 * 
 * Implements:
 * - Supplier Bill Posting (AP Ledger entries)
 * - Supplier AP Balance tracking
 * - Bill types (stock vs non-stock)
 * - Aging reports
 * - Supplier statements
 */

import { Types } from "mongoose";

// ============================================================================
// BILL TYPES
// ============================================================================

export enum BillType {
  STOCK = "STOCK",           // Inventory items (matchable to GRV)
  NON_STOCK = "NON_STOCK",  // Services, expenses (no inventory impact)
  MIXED = "MIXED",          // Contains both stock and non-stock
}

// ============================================================================
// BILL LINE TYPES
// ============================================================================

export enum BillLineType {
  STOCK = "STOCK",      // Links to GRV/StockItem
  NON_STOCK = "NON_STOCK",  // Service/expense line
}

// ============================================================================
// SUPPLIER AP BALANCE
// ============================================================================

/**
 * Supplier AP Balance - computed from bills and payments
 */
export interface SupplierAPBalance {
  supplierId: Types.ObjectId;
  supplierName: string;
  
  // Totals
  totalBilledCents: number;      // Sum of all approved bills
  totalPaidCents: number;         // Sum of all payments
  outstandingCents: number;       // Total outstanding (billed - paid)
  
  // By status
  draftCents: number;
  openCents: number;              // Approved but not fully paid
  overdueCents: number;
  
  // Counts
  totalBills: number;
  unpaidBills: number;
  overdueBills: number;
  
  // Aging
  aging: {
    current: number;      // 0-30 days
    days31_60: number;   // 31-60 days
    days61_90: number;   // 61-90 days
    over90: number;      // 90+ days
  };
  
  // Last activity
  lastBillDate?: Date;
  lastPaymentDate?: Date;
}

// ============================================================================
// AP LEDGER ENTRY
// ============================================================================

/**
 * AP Ledger Entry - immutable record of bill/payment activity
 */
export interface APLedgerEntry {
  _id: Types.ObjectId;
  
  // Company & Supplier
  companyId: Types.ObjectId;
  supplierId: Types.ObjectId;
  
  // Entry type
  entryType: "BILL" | "PAYMENT" | "ADJUSTMENT" | "VOID";
  
  // Reference
  documentType: "SupplierBill" | "SupplierPayment";
  documentId: Types.ObjectId;
  documentNumber: string;
  
  // Amounts (in cents)
  debitCents: number;     // Bill amount (increases AP)
  creditCents: number;   // Payment amount (decreases AP)
  balanceCents: number;  // Running balance after this entry
  
  // Date
  documentDate: Date;
  dueDate?: Date;
  postedAt: Date;
  
  // Aging
  daysOverdue?: number;
  
  // User
  createdBy: Types.ObjectId;
  
  // Immutable
  isImmutable: boolean;
}

// ============================================================================
// BILL POSTING RESULT
// ============================================================================

export interface BillPostingResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  
  // Bill updates
  billId: Types.ObjectId;
  billNumber: string;
  previousStatus: string;
  newStatus: string;
  
  // Financial
  totalCents: number;
  outstandingCents: number;
  
  // GRV updates
  grvsUpdated: number;
  linesInvoiced: number;
  
  // AP entries created
  apEntriesCreated: number;
  
  // Timestamp
  postedAt: Date;
}

// ============================================================================
// SUPPLIER STATEMENT
// ============================================================================

export interface SupplierStatement {
  supplierId: Types.ObjectId;
  supplierName: string;
  
  // Date range
  fromDate: Date;
  toDate: Date;
  
  // Opening balance
  openingBalanceCents: number;
  
  // Transactions in period
  bills: Array<{
    billId: Types.ObjectId;
    billNumber: string;
    date: Date;
    dueDate?: Date;
    amountCents: number;
    paidCents: number;
    outstandingCents: number;
    status: string;
  }>;
  
  payments: Array<{
    paymentId: Types.ObjectId;
    paymentNumber: string;
    date: Date;
    amountCents: number;
  }>;
  
  // Closing balance
  closingBalanceCents: number;
  
  // Totals
  totalBilledCents: number;
  totalPaidCents: number;
}

// ============================================================================
// AGING REPORT
// ============================================================================

export interface AgingReport {
  companyId: Types.ObjectId;
  asOfDate: Date;
  
  // Summary
  totalOutstandingCents: number;
  
  // By aging bucket
  aging: {
    current: number;      // 0-30
    days31_60: number;   // 31-60
    days61_90: number;   // 61-90
    over90: number;       // 90+
  };
  
  // By supplier
  bySupplier: Array<{
    supplierId: Types.ObjectId;
    supplierName: string;
    
    totalOutstandingCents: number;
    
    aging: {
      current: number;
      days31_60: number;
      days61_90: number;
      over90: number;
    };
    
    bills: Array<{
      billId: Types.ObjectId;
      billNumber: string;
      dueDate?: Date;
      amountCents: number;
      daysOverdue: number;
    }>;
  }>;
}

// ============================================================================
// UNPAID BILLS QUERY
// ============================================================================

export interface UnpaidBillQuery {
  supplierId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  includeOverdueOnly?: boolean;
}

export interface UnpaidBill {
  billId: Types.ObjectId;
  billNumber: string;
  supplierId: Types.ObjectId;
  supplierName: string;
  
  billDate: Date;
  dueDate?: Date;
  
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  
  status: string;
  daysOverdue: number;
  agingBucket: "current" | "days31_60" | "days61_90" | "over90";
}

// ============================================================================
// GRV INVOICE TRACKING
// ============================================================================

/**
 * Track invoiced quantity per GRV line
 */
export interface GRVLineInvoicing {
  grvId: Types.ObjectId;
  grvNumber: string;
  
  lineId: Types.ObjectId;
  lineNo: number;
  
  stockItemId: Types.ObjectId;
  itemName: string;
  
  // Quantities
  receivedQty: number;
  invoicedQty: number;
  remainingQty: number;  // received - invoiced
  
  // Status
  isFullyInvoiced: boolean;
}

/**
 * GRV Invoicing Summary
 */
export interface GRVInvoicingSummary {
  grvId: Types.ObjectId;
  grvNumber: string;
  grvDate: Date;
  supplierName: string;
  
  totalReceivedCents: number;
  totalInvoicedCents: number;
  remainingCents: number;
  
  lineCount: number;
  fullyInvoicedLines: number;
  partiallyInvoicedLines: number;
  uninvoicedLines: number;
  
  status: "FULL" | "PARTIAL" | "NONE";
}

/**
 * Invoice Matching Types
 * 
 * Implements 2-way and 3-way matching:
 * - 2-way: PO ↔ Bill
 * - 3-way: PO ↔ GRV ↔ Bill
 */

import { Types } from "mongoose";

// ============================================================================
// MATCH STATUS
// ============================================================================

export enum MatchStatus {
  PASS = "PASS",
  WARNING = "WARNING",
  FAIL = "FAIL",
  PENDING = "PENDING",
}

export enum MatchType {
  TWO_WAY = "2_WAY",      // PO ↔ Bill only
  THREE_WAY = "3_WAY",    // PO ↔ GRV ↔ Bill
}

// ============================================================================
// MATCH TOLERANCE SETTINGS
// ============================================================================

export interface MatchTolerance {
  priceVariancePercent: number;    // Allow price variance (e.g., 5 = 5%)
  priceVarianceAbsolute: number;     // Allow absolute price variance in cents
  amountVariancePercent: number;    // Allow total amount variance
  amountVarianceAbsolute: number;    // Allow absolute amount variance
  allowOverReceipt: boolean;         // Allow billing more than received
  overReceiptPercent: number;        // Over-receipt tolerance
}

export const DEFAULT_MATCH_TOLERANCE: MatchTolerance = {
  priceVariancePercent: 0,
  priceVarianceAbsolute: 0,
  amountVariancePercent: 0,
  amountVarianceAbsolute: 0,
  allowOverReceipt: false,
  overReceiptPercent: 0,
};

// ============================================================================
// MATCH RESULT
// ============================================================================

export interface MatchResult {
  // Summary
  billId: Types.ObjectId;
  billNumber: string;
  matchType: MatchType;
  status: MatchStatus;
  
  // Overall results
  requiresApprovalOverride: boolean;
  reasons: MatchReason[];
  
  // Line-by-line details
  lines: BillMatchLine[];
  
  // Totals comparison
  totals: {
    poTotal: number;        // Sum of PO lines
    grvTotal: number;       // Sum of GRV lines
    billTotal: number;      // Bill total
    variance: number;       // billTotal - grvTotal (or poTotal)
    variancePercent: number;
  };
  
  // Metadata
  matchedAt: Date;
  matchedBy?: Types.ObjectId;
}

/** Individual reason for match warning/failure */
export interface MatchReason {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
  lineNo?: number;
  field?: string;
  poLineId?: Types.ObjectId;
  grvLineId?: Types.ObjectId;
}

/** Per-line matching result */
export interface BillMatchLine {
  lineNo: number;
  
  // Stock item
  stockItemId: Types.ObjectId;
  itemName: string;
  
  // Bill line
  billQty: number;
  billUnitCost: number;
  billLineTotal: number;
  
  // PO reference (if matched)
  poId?: Types.ObjectId;
  poNumber?: string;
  poLineId?: Types.ObjectId;
  poOrderedQty?: number;
  poUnitCost?: number;
  
  // GRV reference (if matched)
  grvId?: Types.ObjectId;
  grvNumber?: string;
  grvLineId?: Types.ObjectId;
  grvReceivedQty?: number;
  
  // Matched quantities
  matchedQty: number;        // Qty that matches
  unmatchedQty: number;     // Qty billed but not received
  overReceiptQty: number;   // Qty over received
  
  // Price comparison
  priceVariance: number;
  priceVariancePercent: number;
  isPriceMatch: boolean;
  
  // Status for this line
  status: MatchStatus;
  reasons: MatchReason[];
}

// ============================================================================
// MATCH SNAPSHOT (Stored on Bill)
// ============================================================================

export interface MatchSnapshot {
  matchType: MatchType;
  status: MatchStatus;
  requiresOverride: boolean;
  
  // Summary
  totalLines: number;
  passedLines: number;
  warningLines: number;
  failedLines: number;
  
  // Amounts
  billTotalCents: number;
  matchedTotalCents: number;
  varianceCents: number;
  
  // PO/GRV references
  linkedPOs: Array<{ poId: Types.ObjectId; poNumber: string }>;
  linkedGRVs: Array<{ grvId: Types.ObjectId; grvNumber: string }>;
  
  // Override info
  overrideReason?: string;
  overriddenBy?: Types.ObjectId;
  overriddenAt?: Date;
  
  // Metadata
  matchedAt: Date;
  matchedBy?: Types.ObjectId;
}

// ============================================================================
// UI MATCHING PANEL DATA
// ============================================================================

export interface MatchingPanelData {
  billId: Types.ObjectId;
  billNumber: string;
  supplierName: string;
  
  // Match type used
  matchType: MatchType;
  
  // Overall status
  status: MatchStatus;
  canApprove: boolean;
  requiresOverride: boolean;
  
  // Summary cards
  summary: {
    totalLines: number;
    matched: number;
    warnings: number;
    failed: number;
  };
  
  // Amount comparison
  amounts: {
    bill: number;
    grv: number;
    po: number;
    variance: number;
    variancePercent: number;
  };
  
  // Detailed line items
  lineItems: Array<{
    lineNo: number;
    itemName: string;
    
    // Quantities
    billQty: number;
    receivedQty: number;
    orderedQty: number;
    
    // Status indicators
    isOverReceived: boolean;
    isUnderReceived: boolean;
    isPriceMismatch: boolean;
    isNoGRV: boolean;
    
    // Messages
    messages: string[];
    
    // Actions needed
    needsAttention: boolean;
  }>;
  
  // GRV breakdown
  grvBreakdown: Array<{
    grvId: Types.ObjectId;
    grvNumber: string;
    grvDate: Date;
    matchedLines: number;
    totalLines: number;
    status: "FULL" | "PARTIAL" | "NONE";
  }>;
  
  // Override form (if needed)
  overrideForm?: {
    reason: string;
    required?: boolean;
  };
}

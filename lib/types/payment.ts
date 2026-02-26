/**
 * Supplier Payment Types
 * 
 * Implements:
 * - Payment allocations
 * - Supplier credits (for overpayments)
 * - Auto-allocation (FIFO)
 * - Manual allocation UI
 */

import { Types } from "mongoose";

// ============================================================================
// ALLOCATION TYPES
// ============================================================================

export interface PaymentAllocation {
  billId: Types.ObjectId;
  billNumber: string;
  
  // Amounts
  allocationAmountCents: number;
  
  // After payment
  billOutstandingBefore: number;
  billOutstandingAfter: number;
}

export interface PaymentAllocationInput {
  billId: string;
  amountCents: number;
}

// ============================================================================
// PAYMENT POSTING RESULT
// ============================================================================

export interface PaymentPostingResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  
  // Payment details
  paymentId: Types.ObjectId;
  paymentNumber: string;
  previousStatus: string;
  newStatus: string;
  
  // Financial
  paymentAmountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  
  // Bills updated
  billsUpdated: number;
  
  // Credit created (if overpayment)
  creditCreated: boolean;
  creditAmountCents: number;
  
  // Timestamp
  postedAt: Date;
}

// ============================================================================
// SUPPLIER CREDIT (For Overpayments)
// ============================================================================

export interface SupplierCredit {
  _id: Types.ObjectId;
  
  // Company & Supplier
  companyId: Types.ObjectId;
  supplierId: Types.ObjectId;
  
  // Reference
  creditNumber: string;
  creditType: "OVERPAYMENT" | "RETURN" | "DISCOUNT" | "ADJUSTMENT";
  
  // Amount
  originalAmountCents: number;
  appliedAmountCents: number;
  remainingAmountCents: number;
  
  // Source payment
  paymentId?: Types.ObjectId;
  paymentNumber?: string;
  
  // Status
  status: "OPEN" | "PARTIALLY_APPLIED" | "FULLY_APPLIED" | "VOIDED";
  
  // Notes
  reason?: string;
  notes?: string;
  
  // Dates
  creditDate: Date;
  createdAt: Date;
  appliedAt?: Date;
  
  // User
  createdBy: Types.ObjectId;
}

// ============================================================================
// PAYMENT UI DATA
// ============================================================================

export interface PayBillsUIData {
  supplierId: Types.ObjectId;
  supplierName: string;
  
  // Payment details form
  paymentForm: {
    amountCents: number;
    paymentDate: Date;
    method: "Cash" | "EFT" | "Card" | "Cheque";
    reference: string;
    notes: string;
  };
  
  // Open bills to pay
  openBills: Array<{
    billId: Types.ObjectId;
    billNumber: string;
    billDate: Date;
    dueDate?: Date;
    
    totalCents: number;
    paidCents: number;
    outstandingCents: number;
    
    daysOverdue: number;
    isOverdue: boolean;
    
    // Allocation
    selected: boolean;
    allocationCents: number;
  }>;
  
  // Summary
  summary: {
    totalOutstanding: number;
    selectedBills: number;
    selectedAmount: number;
    paymentAmount: number;
    overpayment: number;
  };
  
  // Auto-allocate options
  autoAllocate: {
    enabled: boolean;
    method: "FIFO" | "LIFO" | "OLDEST_OVERDUE";
  };
}

// ============================================================================
// PAYMENT VALIDATION
// ============================================================================

export interface PaymentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  
  allocations: Array<{
    billId: string;
    billNumber: string;
    amountCents: number;
    outstandingBefore: number;
    isValid: boolean;
    error?: string;
  }>;
  
  totalAllocatedCents: number;
  paymentAmountCents: number;
  overpaymentCents: number;
}

// ============================================================================
// PAYMENT QUERY TYPES
// ============================================================================

export interface PaymentQuery {
  supplierId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface PaymentWithAllocations {
  paymentId: Types.ObjectId;
  paymentNumber: string;
  
  supplierId: Types.ObjectId;
  supplierName: string;
  
  paymentDate: Date;
  method: string;
  reference: string;
  
  amountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  
  status: string;
  
  allocations: Array<{
    billId: Types.ObjectId;
    billNumber: string;
    amountCents: number;
  }>;
  
  createdAt: Date;
}

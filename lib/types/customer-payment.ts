/**
 * Customer Payment Types
 *
 * Implements:
 * - Payment allocations to invoices
 * - Client balance calculation
 * - Auto-allocation (FIFO - oldest invoice first)
 * - Manual allocation UI
 */

import { Types } from "mongoose";

// ============================================================================
// ALLOCATION TYPES
// ============================================================================

export interface CustomerPaymentAllocation {
  invoiceId: Types.ObjectId;
  invoiceNumber: string;

  // Amounts
  allocationAmountCents: number;

  // After payment
  invoiceOutstandingBefore: number;
  invoiceOutstandingAfter: number;
}

export interface CustomerPaymentAllocationInput {
  invoiceId: string;
  amountCents: number;
}

// ============================================================================
// PAYMENT POSTING RESULT
// ============================================================================

export interface CustomerPaymentPostingResult {
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

  // Invoices updated
  invoicesUpdated: number;

  // Timestamp
  postedAt: Date;
}

// ============================================================================
// PAYMENT UI DATA
// ============================================================================

export interface PayInvoicesUIData {
  clientId: Types.ObjectId;
  clientName: string;

  // Payment details form
  paymentForm: {
    amountCents: number;
    paymentDate: Date;
    paymentMethod: "cash" | "bank_transfer" | "card" | "other";
    reference: string;
    notes: string;
  };

  // Open invoices to pay
  openInvoices: Array<{
    invoiceId: Types.ObjectId;
    invoiceNumber: string;
    issueDate: Date;
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
    selectedInvoices: number;
    selectedAmount: number;
    paymentAmount: number;
  };
}

// ============================================================================
// PAYMENT VALIDATION
// ============================================================================

export interface CustomerPaymentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];

  allocations: Array<{
    invoiceId: string;
    invoiceNumber: string;
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

export interface CustomerPaymentQuery {
  clientId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface CustomerPaymentWithAllocations {
  paymentId: Types.ObjectId;
  paymentNumber: string;

  clientId: Types.ObjectId;
  clientName: string;

  paymentDate: Date;
  paymentMethod: string;
  reference: string;

  amountCents: number;
  allocatedCents: number;
  unallocatedCents: number;

  status: string;

  allocations: Array<{
    invoiceId: Types.ObjectId;
    invoiceNumber: string;
    amountCents: number;
  }>;

  createdAt: Date;
}

// ============================================================================
// CLIENT BALANCE TYPES
// ============================================================================

export interface ClientBalance {
  clientId: Types.ObjectId;
  clientName: string;

  // Overall totals
  totalOwing: number; // totalInvoiced - totalPaid
  totalPaid: number;
  totalInvoiced: number;

  // Aging analysis
  overdueAmount: number; // Amount past due date
  currentAmount: number; // Due within 30 days
  days31To60: number;
  days61To90: number;
  days91Plus: number;

  // Recent activity
  lastPaymentDate?: Date;
  lastInvoiceDate?: Date;
}
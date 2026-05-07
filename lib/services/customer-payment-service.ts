/**
 * Customer Payment Service
 *
 * Implements:
 * - Payment allocation across multiple invoices
 * - Auto-allocation (FIFO - oldest invoice first)
 * - Manual allocation UI
 * - Client balance calculation
 * - Payment voiding with reversal
 */

import { dbConnect } from "@/lib/db";
import { CustomerPayment } from "@/lib/models/CustomerPayment";
import { SalesInvoice } from "@/lib/models/SalesInvoice";
import { Client } from "@/lib/models/Client";
import { Counter } from "@/lib/models/Counter";
import { Types } from "mongoose";

import {
  CustomerPaymentAllocationInput,
  CustomerPaymentPostingResult,
  PayInvoicesUIData,
  CustomerPaymentValidationResult,
  CustomerPaymentWithAllocations,
} from "@/lib/types/customer-payment";
import { logAuditEntry, TransitionResult } from "./p2p-service";

// ============================================================================
// PAYMENT POSTING
// ============================================================================

/**
 * Post a payment with allocations
 */
export async function postCustomerPayment(
  paymentData: {
    clientId: string;
    amountCents: number;
    paymentDate: Date;
    paymentMethod: "cash" | "bank_transfer" | "card" | "other";
    reference?: string;
    notes?: string;
    allocations?: CustomerPaymentAllocationInput[];
  },
  userId: string,
  userRole: string,
  allowOverpayment: boolean = false
): Promise<CustomerPaymentPostingResult> {
  const result: CustomerPaymentPostingResult = {
    success: false,
    errors: [],
    warnings: [],
    paymentId: new Types.ObjectId(),
    paymentNumber: "",
    previousStatus: "DRAFT",
    newStatus: "",
    paymentAmountCents: paymentData.amountCents,
    allocatedCents: 0,
    unallocatedCents: 0,
    invoicesUpdated: 0,
    postedAt: new Date(),
  };

  await dbConnect();

  // Validate allocations
  const validation = await validateCustomerAllocations(
    paymentData.clientId,
    paymentData.amountCents,
    paymentData.allocations || [],
    allowOverpayment
  );

  if (!validation.valid) {
    result.errors = validation.errors;
    return result;
  }

  result.warnings = validation.warnings;

  // Generate payment number
  const paymentNumber = await generateCustomerPaymentNumber(userId);

  // Start transaction
  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get client for snapshot
    const client = await Client.findById(paymentData.clientId).session(session);
    if (!client) {
      throw new Error("Client not found");
    }

    const clientSnapshot = {
      name: client.name,
      email: client.email || "",
    };

    // Create payment
    const payment = await CustomerPayment.create(
      [
        {
          paymentNumber,
          clientId: paymentData.clientId,
          clientSnapshot,
          amountCents: paymentData.amountCents,
          paymentDate: paymentData.paymentDate,
          paymentMethod: paymentData.paymentMethod,
          reference: paymentData.reference || "",
          allocatedInvoices: [],
          unallocatedCents: 0,
          status: "posted",
          notes: paymentData.notes || "",
          postedAt: new Date(),
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        },
      ],
      { session }
    );

    result.paymentId = payment[0]._id;
    result.paymentNumber = paymentNumber;

    // Process allocations
    let totalAllocated = 0;
    let invoicesUpdated = 0;

    if (validation.allocations.length > 0) {
      for (const alloc of validation.allocations) {
        if (alloc.amountCents <= 0) continue;

        const invoice = await SalesInvoice.findById(alloc.invoiceId).session(session);
        if (!invoice) continue;

        // Update invoice
        const outstandingBefore = invoice.balanceDueCents || 0;
        const newAmountPaid = (invoice.amountPaidCents || 0) + alloc.amountCents;
        const newBalanceDue = Math.max(0, (invoice.totals.totalCents || 0) - newAmountPaid);

        // Determine status
        let newStatus = invoice.status;
        if (newBalanceDue <= 0) {
          newStatus = "paid";
        } else if (newAmountPaid > 0) {
          newStatus = "partially_paid";
        }

        await SalesInvoice.updateOne(
          { _id: invoice._id },
          {
            $set: {
              amountPaidCents: newAmountPaid,
              balanceDueCents: newBalanceDue,
              status: newStatus,
              paidAt: newBalanceDue <= 0 ? new Date() : null,
            },
          },
          { session }
        );

        // Record allocation
        await CustomerPayment.updateOne(
          { _id: payment[0]._id },
          {
            $push: {
              allocatedInvoices: {
                invoiceId: invoice._id,
                amountCents: alloc.amountCents,
                allocatedAt: new Date(),
              },
            },
          },
          { session }
        );

        totalAllocated += alloc.amountCents;
        invoicesUpdated++;
      }
    }

    // Handle overpayment (could create client credit in future)
    let unallocated = paymentData.amountCents - totalAllocated;

    if (unallocated > 0) {
      await CustomerPayment.updateOne(
        { _id: payment[0]._id },
        { $set: { unallocatedCents: unallocated } },
        { session }
      );
      result.warnings.push(
        `Payment has ${unallocated} cents unallocated`
      );
    }

    result.allocatedCents = totalAllocated;
    result.unallocatedCents = unallocated;
    result.invoicesUpdated = invoicesUpdated;
    result.newStatus = "Posted";

    await session.commitTransaction();

    // Audit - TODO: Add CustomerPayment to audit types
    // await logAuditEntry({
    //   docType: "CustomerPayment",
    //   docId: payment[0]._id,
    //   docNumber: paymentNumber,
    //   action: "POST",
    //   userId,
    //   userRole,
    //   screen: "CustomerPayments",
    // });
  } catch (error: any) {
    await session.abortTransaction();
    result.errors.push(`Transaction failed: ${error.message}`);
    return result;
  } finally {
    session.endSession();
  }

  result.success = true;
  result.postedAt = new Date();
  return result;
}

// ============================================================================
// VOID PAYMENT
// ============================================================================

/**
 * Void a posted customer payment
 */
export async function voidCustomerPayment(
  paymentId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<CustomerPaymentPostingResult> {
  const result: CustomerPaymentPostingResult = {
    success: false,
    errors: [],
    warnings: [],
    paymentId: new Types.ObjectId(paymentId),
    paymentNumber: "",
    previousStatus: "",
    newStatus: "",
    paymentAmountCents: 0,
    allocatedCents: 0,
    unallocatedCents: 0,
    invoicesUpdated: 0,
    postedAt: new Date(),
  };

  await dbConnect();

  const payment = await CustomerPayment.findById(paymentId);
  if (!payment) {
    result.errors.push("Payment not found");
    return result;
  }

  if (payment.status !== "posted") {
    result.errors.push("Only posted payments can be voided");
    return result;
  }

  result.previousStatus = payment.status;
  result.paymentNumber = payment.paymentNumber;
  result.paymentAmountCents = payment.amountCents || 0;
  result.allocatedCents = (payment.allocatedInvoices || []).reduce(
    (sum: number, a: any) => sum + (a.amountCents || 0),
    0
  );

  // Start transaction
  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Reverse allocations on invoices
    for (const alloc of payment.allocatedInvoices || []) {
      const invoice = await SalesInvoice.findById(alloc.invoiceId).session(session);
      if (!invoice) continue;

      const newAmountPaid = Math.max(0, (invoice.amountPaidCents || 0) - alloc.amountCents);
      const newBalanceDue = (invoice.totals.totalCents || 0) - newAmountPaid;

      let newStatus = invoice.status;
      if (newAmountPaid <= 0) {
        newStatus = "issued";
      } else {
        newStatus = "partially_paid";
      }

      await SalesInvoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            amountPaidCents: newAmountPaid,
            balanceDueCents: newBalanceDue,
            status: newStatus,
            paidAt: null,
          },
        },
        { session }
      );

      result.invoicesUpdated++;
    }

    // Update payment status
    payment.status = "reversed";
    payment.notes = (payment.notes || "") + `\n[REVERSED: ${reason}]`;
    payment.reversedAt = new Date();
    payment.updatedBy = new Types.ObjectId(userId);
    await payment.save({ session });

    result.newStatus = "Reversed";

    await session.commitTransaction();

    // Audit - TODO: Add CustomerPayment to audit types
    // await logAuditEntry({
    //   docType: "CustomerPayment",
    //   docId: payment._id,
    //   docNumber: payment.paymentNumber,
    //   action: "VOID",
    //   userId,
    //   userRole,
    //   screen: "CustomerPayments",
    //   reason,
    // });
  } catch (error: any) {
    await session.abortTransaction();
    result.errors.push(`Transaction failed: ${error.message}`);
    return result;
  } finally {
    session.endSession();
  }

  result.success = true;
  return result;
}

// ============================================================================
// AUTO-ALLOCATION
// ============================================================================

/**
 * Auto-allocate payment to open invoices (FIFO - oldest first)
 */
export async function autoAllocateCustomerPayment(
  clientId: string,
  paymentAmountCents: number
): Promise<CustomerPaymentAllocationInput[]> {
  await dbConnect();

  // Get open invoices (issued or partially paid, ordered by issue date)
  const invoices = await SalesInvoice.find({
    clientId,
    isDeleted: false,
    status: { $in: ["issued", "partially_paid"] },
  })
    .sort({ issueDate: 1, createdAt: 1 })
    .lean();

  // Allocate FIFO (oldest first)
  const allocations: CustomerPaymentAllocationInput[] = [];
  let remaining = paymentAmountCents;

  for (const invoice of invoices) {
    if (remaining <= 0) break;

    const outstanding = invoice.balanceDueCents || 0;
    if (outstanding <= 0) continue;

    const allocate = Math.min(remaining, outstanding);
    allocations.push({
      invoiceId: invoice._id.toString(),
      amountCents: allocate,
    });

    remaining -= allocate;
  }

  return allocations;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate customer payment allocations
 */
export async function validateCustomerAllocations(
  clientId: string,
  paymentAmountCents: number,
  allocations: CustomerPaymentAllocationInput[],
  allowOverpayment: boolean = false
): Promise<CustomerPaymentValidationResult> {
  const result: CustomerPaymentValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    allocations: [],
    totalAllocatedCents: 0,
    paymentAmountCents,
    overpaymentCents: 0,
  };

  // Check allocations
  for (const alloc of allocations) {
    const invoice = await SalesInvoice.findById(alloc.invoiceId).lean();
    if (!invoice) {
      result.valid = false;
      result.errors.push(`Invoice ${alloc.invoiceId} not found`);
      continue;
    }

    // Check client match
    if (invoice.clientId?.toString() !== clientId) {
      result.valid = false;
      result.errors.push(
        `Invoice ${invoice.invoiceNumber} is for a different client`
      );
      continue;
    }

    // Check status
    if (!["issued", "partially_paid"].includes(invoice.status)) {
      result.valid = false;
      result.errors.push(
        `Invoice ${invoice.invoiceNumber} is not in payable status (${invoice.status})`
      );
      continue;
    }

    const outstanding = invoice.balanceDueCents || 0;

    // Check allocation doesn't exceed outstanding
    if (alloc.amountCents > outstanding) {
      result.valid = false;
      result.errors.push(
        `Allocation (${alloc.amountCents}) exceeds outstanding (${outstanding}) for invoice ${invoice.invoiceNumber}`
      );
    }

    result.allocations.push({
      invoiceId: alloc.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amountCents: alloc.amountCents,
      outstandingBefore: outstanding,
      isValid: alloc.amountCents <= outstanding,
      error: alloc.amountCents > outstanding ? "Exceeds outstanding" : undefined,
    });

    result.totalAllocatedCents += alloc.amountCents;
  }

  // Check total allocation vs payment amount
  result.overpaymentCents = result.totalAllocatedCents - paymentAmountCents;

  if (result.overpaymentCents > 0 && !allowOverpayment) {
    result.valid = false;
    result.errors.push(
      `Total allocations (${result.totalAllocatedCents}) exceed payment amount (${paymentAmountCents})`
    );
  }

  return result;
}

// ============================================================================
// UI DATA
// ============================================================================

/**
 * Get Pay Invoices UI data
 */
export async function getPayInvoicesUIData(
  clientId: string
): Promise<PayInvoicesUIData | null> {
  await dbConnect();

  const client = await Client.findById(clientId).lean();
  if (!client) return null;

  // Get open invoices
  const invoices = await SalesInvoice.find({
    clientId,
    isDeleted: false,
    status: { $in: ["issued", "partially_paid"] },
  })
    .sort({ issueDate: 1, createdAt: 1 })
    .lean();

  const now = new Date();

  const openInvoices = invoices.map((invoice) => {
    const total = invoice.totals.totalCents || 0;
    const paid = invoice.amountPaidCents || 0;
    const outstanding = invoice.balanceDueCents || 0;

    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const daysOverdue = dueDate
      ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

    return {
      invoiceId: invoice._id as Types.ObjectId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalCents: total,
      paidCents: paid,
      outstandingCents: outstanding,
      daysOverdue,
      isOverdue: dueDate ? dueDate < now : false,
      selected: false,
      allocationCents: 0,
    };
  });

  const totalOutstanding = openInvoices.reduce((sum, inv) => sum + inv.outstandingCents, 0);

  return {
    clientId: client._id as Types.ObjectId,
    clientName: client.name,
    paymentForm: {
      amountCents: 0,
      paymentDate: new Date(),
      paymentMethod: "bank_transfer",
      reference: "",
      notes: "",
    },
    openInvoices,
    summary: {
      totalOutstanding,
      selectedInvoices: 0,
      selectedAmount: 0,
      paymentAmount: 0,
    },
  };
}

// ============================================================================
// CLIENT BALANCE CALCULATION
// ============================================================================

/**
 * Calculate client balance (total owing)
 */
export async function calculateClientBalance(clientId: string): Promise<{
  totalOwing: number;
  totalPaid: number;
  totalInvoiced: number;
  overdueAmount: number;
}> {
  await dbConnect();

  // Get all non-cancelled invoices for client
  const invoices = await SalesInvoice.find({
    clientId,
    isDeleted: false,
    status: { $ne: "cancelled" },
  }).lean();

  const now = new Date();
  let totalInvoiced = 0;
  let totalPaid = 0;
  let overdueAmount = 0;

  for (const invoice of invoices) {
    const total = invoice.totals.totalCents || 0;
    const paid = invoice.amountPaidCents || 0;
    const balance = invoice.balanceDueCents || 0;

    totalInvoiced += total;
    totalPaid += paid;

    // Check if overdue
    if (balance > 0 && invoice.dueDate && new Date(invoice.dueDate) < now) {
      overdueAmount += balance;
    }
  }

  const totalOwing = totalInvoiced - totalPaid;

  return {
    totalOwing,
    totalPaid,
    totalInvoiced,
    overdueAmount,
  };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get payment with allocations
 */
export async function getCustomerPaymentWithAllocations(
  paymentId: string
): Promise<CustomerPaymentWithAllocations | null> {
  await dbConnect();

  const payment = await CustomerPayment.findById(paymentId)
    .populate("clientId", "name")
    .populate("allocatedInvoices.invoiceId", "invoiceNumber")
    .lean();

  if (!payment) return null;

  return {
    paymentId: payment._id as Types.ObjectId,
    paymentNumber: payment.paymentNumber,
    clientId: payment.clientId as Types.ObjectId,
    clientName: (payment.clientId as any)?.name || "",
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    reference: payment.reference || "",
    amountCents: payment.amountCents || 0,
    allocatedCents: (payment.allocatedInvoices || []).reduce(
      (sum: number, a: any) => sum + (a.amountCents || 0),
      0
    ),
    unallocatedCents: payment.unallocatedCents || 0,
    status: payment.status,
    allocations: (payment.allocatedInvoices || []).map((a: any) => ({
      invoiceId: a.invoiceId as Types.ObjectId,
      invoiceNumber: (a.invoiceId as any)?.invoiceNumber || "",
      amountCents: a.amountCents || 0,
    })),
    createdAt: payment.createdAt,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate customer payment number
 */
async function generateCustomerPaymentNumber(userId: string): Promise<string> {
  await dbConnect();

  const counter = await Counter.findOneAndUpdate(
    { key: "CUSTOMER_PAYMENT", isDeleted: false },
    { $inc: { nextNumber: 1 } },
    { upsert: true, new: true }
  );

  const num = String(counter.nextNumber).padStart(6, "0");
  return `CUST-PAY-${num}`;
}
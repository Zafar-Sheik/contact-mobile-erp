/**
 * Supplier Payment Service
 * 
 * Implements:
 * - Payment allocation across multiple bills
 * - Auto-allocation (FIFO)
 * - Manual allocation UI
 * - Overpayment handling (supplier credits)
 * - Payment voiding with reversal
 */

import { dbConnect } from "@/lib/db";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { Supplier } from "@/lib/models/Supplier";
import { Counter } from "@/lib/models/Counter";
import { Types } from "mongoose";

import {
  PaymentAllocationInput,
  PaymentPostingResult,
  SupplierCredit,
  PayBillsUIData,
  PaymentValidationResult,
  PaymentWithAllocations,
} from "@/lib/types/payment";
import { logAuditEntry, TransitionResult } from "./p2p-service";
import { AuditAction, SupplierBillStatus } from "@/lib/types/p2p-status";

// ============================================================================
// PAYMENT POSTING
// ============================================================================

/**
 * Post a payment with allocations
 */
export async function postPayment(
  paymentData: {
    supplierId: string;
    amountCents: number;
    paymentDate: Date;
    method: "Cash" | "EFT" | "Card" | "Cheque";
    reference?: string;
    notes?: string;
    allocations?: PaymentAllocationInput[];
  },
  userId: string,
  userRole: string,
  allowOverpayment: boolean = false
): Promise<PaymentPostingResult> {
  const result: PaymentPostingResult = {
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
    billsUpdated: 0,
    creditCreated: false,
    creditAmountCents: 0,
    postedAt: new Date(),
  };

  await dbConnect();

  // Validate allocations
  const validation = await validateAllocations(
    paymentData.supplierId,
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
  const paymentNumber = await generatePaymentNumber(userId);

  // Start transaction
  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create payment
    const payment = await SupplierPayment.create(
      [
        {
          supplierId: paymentData.supplierId,
          paymentNumber,
          paymentDate: paymentData.paymentDate,
          method: paymentData.method,
          reference: paymentData.reference || "",
          amountCents: paymentData.amountCents,
          allocations: [],
          unallocatedCents: 0,
          status: "POSTED",
          notes: paymentData.notes || "",
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
    let billsUpdated = 0;

    if (validation.allocations.length > 0) {
      for (const alloc of validation.allocations) {
        if (alloc.amountCents <= 0) continue;

        const bill = await SupplierBill.findById(alloc.billId).session(session);
        if (!bill) continue;

        // Update bill
        const outstandingBefore = bill.totalCents - (bill.paidCents || 0);
        const newPaid = (bill.paidCents || 0) + alloc.amountCents;
        const outstandingAfter = bill.totalCents - newPaid;

        // Determine status
        let newStatus = bill.status;
        if (outstandingAfter <= 0) {
          newStatus = SupplierBillStatus.PAID;
        } else if (newPaid > 0) {
          newStatus = SupplierBillStatus.PARTIALLY_PAID;
        }

        await SupplierBill.updateOne(
          { _id: bill._id },
          {
            $set: {
              paidCents: newPaid,
              status: newStatus,
            },
          },
          { session }
        );

        // Record allocation
        await SupplierPayment.updateOne(
          { _id: payment[0]._id },
          {
            $push: {
              allocations: {
                supplierBillId: bill._id,
                amountCents: alloc.amountCents,
              },
            },
          },
          { session }
        );

        totalAllocated += alloc.amountCents;
        billsUpdated++;
      }
    }

    // Handle overpayment
    let creditCreated = false;
    let creditAmount = 0;
    const unallocated = paymentData.amountCents - totalAllocated;

    if (unallocated > 0) {
      if (allowOverpayment) {
        // Create supplier credit
        const credit = await createSupplierCredit(
          paymentData.supplierId,
          payment[0]._id,
          paymentNumber,
          unallocated,
          "OVERPAYMENT",
          session,
          userId
        );
        creditCreated = true;
        creditAmount = unallocated;

        // Update payment unallocated
        await SupplierPayment.updateOne(
          { _id: payment[0]._id },
          { $set: { unallocatedCents: unallocated } },
          { session }
        );
      } else {
        // Just leave as unallocated
        await SupplierPayment.updateOne(
          { _id: payment[0]._id },
          { $set: { unallocatedCents: unallocated } },
          { session }
        );
        result.warnings.push(
          `Payment has ${unallocated} cents unallocated`
        );
      }
    }

    result.allocatedCents = totalAllocated;
    result.unallocatedCents = unallocated;
    result.billsUpdated = billsUpdated;
    result.creditCreated = creditCreated;
    result.creditAmountCents = creditAmount;
    result.newStatus = "Posted";

    await session.commitTransaction();

    // Audit
    await logAuditEntry({
      docType: "SupplierPayment",
      docId: payment[0]._id,
      docNumber: paymentNumber,
      action: AuditAction.POST,
      userId,
      userRole,
      screen: "SupplierPayments",
    });
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
 * Void a posted payment
 */
export async function voidPayment(
  paymentId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<PaymentPostingResult> {
  const result: PaymentPostingResult = {
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
    billsUpdated: 0,
    creditCreated: false,
    creditAmountCents: 0,
    postedAt: new Date(),
  };

  await dbConnect();

  const payment = await SupplierPayment.findById(paymentId);
  if (!payment) {
    result.errors.push("Payment not found");
    return result;
  }

  if (payment.status !== "POSTED") {
    result.errors.push("Only posted payments can be voided");
    return result;
  }

  result.previousStatus = payment.status;
  result.paymentNumber = payment.paymentNumber;
  result.paymentAmountCents = payment.amountCents || 0;
  result.allocatedCents = (payment.allocations || []).reduce(
    (sum: number, a: any) => sum + (a.amountCents || 0),
    0
  );

  // Start transaction
  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Reverse allocations on bills
    for (const alloc of payment.allocations || []) {
      const bill = await SupplierBill.findById(alloc.supplierBillId).session(
        session
      );
      if (!bill) continue;

      const newPaid = Math.max(0, (bill.paidCents || 0) - alloc.amountCents);
      const outstandingAfter = bill.totalCents - newPaid;

      let newStatus = bill.status;
      if (newPaid <= 0) {
        newStatus = SupplierBillStatus.APPROVED;
      } else {
        newStatus = SupplierBillStatus.PARTIALLY_PAID;
      }

      await SupplierBill.updateOne(
        { _id: bill._id },
        {
          $set: {
            paidCents: newPaid,
            status: newStatus,
          },
        },
        { session }
      );

      result.billsUpdated++;
    }

    // Void any supplier credit
    // (In full implementation, would reverse credits)

    // Update payment status
    payment.status = "VOIDED";
    payment.notes = (payment.notes || "") + `\n[VOIDED: ${reason}]`;
    payment.updatedBy = new Types.ObjectId(userId);
    await payment.save({ session });

    result.newStatus = "Voided";

    await session.commitTransaction();

    // Audit
    await logAuditEntry({
      docType: "SupplierPayment",
      docId: payment._id,
      docNumber: payment.paymentNumber,
      action: AuditAction.VOID,
      userId,
      userRole,
      screen: "SupplierPayments",
      reason,
    });
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
 * Auto-allocate payment to open bills (FIFO)
 */
export async function autoAllocatePayment(
  supplierId: string,
  paymentAmountCents: number,
  method: "FIFO" | "LIFO" | "OLDEST_OVERDUE" = "FIFO"
): Promise<PaymentAllocationInput[]> {
  await dbConnect();

  // Get open bills
  const bills = await SupplierBill.find({
    supplierId,
    isDeleted: false,
    status: { $in: ["APPROVED", "PARTIALLY_PAID"] },
  })
    .sort({ dueDate: 1, billDate: 1 })
    .lean();

  // Sort based on method
  let sortedBills = [...bills];
  switch (method) {
    case "FIFO":
      sortedBills.sort((a, b) => {
        // Sort by due date, then bill date
        const aDate = (a as any).dueDate || (a as any).billDate;
        const bDate = (b as any).dueDate || (b as any).billDate;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
      break;
    case "LIFO":
      sortedBills.sort((a, b) => {
        const aDate = (a as any).dueDate || (a as any).billDate;
        const bDate = (b as any).dueDate || (b as any).billDate;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
      break;
    case "OLDEST_OVERDUE":
      sortedBills.sort((a, b) => {
        const now = new Date();
        const aOverdue = ((a as any).dueDate || (a as any).billDate) < now ? -1 : 1;
        const bOverdue = ((b as any).dueDate || (b as any).billDate) < now ? -1 : 1;
        return aOverdue - bOverdue;
      });
      break;
  }

  // Allocate
  const allocations: PaymentAllocationInput[] = [];
  let remaining = paymentAmountCents;

  for (const bill of sortedBills) {
    if (remaining <= 0) break;

    const outstanding = (bill.totalCents || 0) - (bill.paidCents || 0);
    if (outstanding <= 0) continue;

    const allocate = Math.min(remaining, outstanding);
    allocations.push({
      billId: bill._id.toString(),
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
 * Validate payment allocations
 */
export async function validateAllocations(
  supplierId: string,
  paymentAmountCents: number,
  allocations: PaymentAllocationInput[],
  allowOverpayment: boolean = false
): Promise<PaymentValidationResult> {
  const result: PaymentValidationResult = {
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
    const bill = await SupplierBill.findById(alloc.billId).lean();
    if (!bill) {
      result.valid = false;
      result.errors.push(`Bill ${alloc.billId} not found`);
      continue;
    }

    // Check supplier match
    if (bill.supplierId?.toString() !== supplierId) {
      result.valid = false;
      result.errors.push(
        `Bill ${bill.billNumber} is for a different supplier`
      );
      continue;
    }

    // Check status
    if (bill.status !== "APPROVED" && bill.status !== "PARTIALLY_PAID") {
      result.valid = false;
      result.errors.push(
        `Bill ${bill.billNumber} is not in payable status (${bill.status})`
      );
      continue;
    }

    const outstanding = (bill.totalCents || 0) - (bill.paidCents || 0);

    // Check allocation doesn't exceed outstanding
    if (alloc.amountCents > outstanding) {
      result.valid = false;
      result.errors.push(
        `Allocation (${alloc.amountCents}) exceeds outstanding (${outstanding}) for bill ${bill.billNumber}`
      );
    }

    result.allocations.push({
      billId: alloc.billId,
      billNumber: bill.billNumber,
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
 * Get Pay Bills UI data
 */
export async function getPayBillsUIData(
  supplierId: string
): Promise<PayBillsUIData | null> {
  await dbConnect();

  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier) return null;

  // Get open bills
  const bills = await SupplierBill.find({
    supplierId,
    isDeleted: false,
    status: { $in: ["APPROVED", "PARTIALLY_PAID"] },
  })
    .sort({ dueDate: 1, billDate: 1 })
    .lean();

  const now = new Date();

  const openBills = bills.map((bill) => {
    const total = bill.totalCents || 0;
    const paid = bill.paidCents || 0;
    const outstanding = total - paid;

    const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
    const daysOverdue = dueDate
      ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

    return {
      billId: bill._id as Types.ObjectId,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      totalCents: total,
      paidCents: paid,
      outstandingCents: outstanding,
      daysOverdue,
      isOverdue: dueDate ? dueDate < now : false,
      selected: false,
      allocationCents: 0,
    };
  });

  const totalOutstanding = openBills.reduce((sum, b) => sum + b.outstandingCents, 0);

  return {
    supplierId: supplier._id as Types.ObjectId,
    supplierName: supplier.name,
    paymentForm: {
      amountCents: 0,
      paymentDate: new Date(),
      method: "EFT",
      reference: "",
      notes: "",
    },
    openBills,
    summary: {
      totalOutstanding,
      selectedBills: 0,
      selectedAmount: 0,
      paymentAmount: 0,
      overpayment: 0,
    },
    autoAllocate: {
      enabled: false,
      method: "FIFO",
    },
  };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get payment with allocations
 */
export async function getPaymentWithAllocations(
  paymentId: string
): Promise<PaymentWithAllocations | null> {
  await dbConnect();

  const payment = await SupplierPayment.findById(paymentId)
    .populate("supplierId", "name")
    .populate("allocations.supplierBillId", "billNumber")
    .lean();

  if (!payment) return null;

  return {
    paymentId: payment._id as Types.ObjectId,
    paymentNumber: payment.paymentNumber,
    supplierId: payment.supplierId as Types.ObjectId,
    supplierName: (payment.supplierId as any)?.name || "",
    paymentDate: payment.paymentDate,
    method: payment.method,
    reference: payment.reference || "",
    amountCents: payment.amountCents || 0,
    allocatedCents: (payment.allocations || []).reduce(
      (sum: number, a: any) => sum + (a.amountCents || 0),
      0
    ),
    unallocatedCents: payment.unallocatedCents || 0,
    status: payment.status,
    allocations: (payment.allocations || []).map((a: any) => ({
      billId: a.supplierBillId as Types.ObjectId,
      billNumber: (a.supplierBillId as any)?.billNumber || "",
      amountCents: a.amountCents || 0,
    })),
    createdAt: payment.createdAt,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate payment number
 */
async function generatePaymentNumber(userId: string): Promise<string> {
  await dbConnect();

  const counter = await Counter.findOneAndUpdate(
    { key: "PAYMENT", isDeleted: false },
    { $inc: { nextNumber: 1 } },
    { upsert: true, new: true }
  );

  const num = String(counter.nextNumber).padStart(6, "0");
  return `PAY-${num}`;
}

/**
 * Create supplier credit
 */
async function createSupplierCredit(
  supplierId: string | Types.ObjectId,
  paymentId: Types.ObjectId,
  paymentNumber: string,
  amountCents: number,
  creditType: string,
  session: any,
  userId: string
): Promise<any> {
  // In a full implementation, would create SupplierCredit collection
  // For now, store on payment

  return {
    supplierId,
    paymentId,
    paymentNumber,
    amountCents,
    creditType,
    status: "OPEN",
  };
}

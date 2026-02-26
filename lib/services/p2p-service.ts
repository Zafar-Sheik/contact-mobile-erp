/**
 * P2P Service Layer
 * 
 * Implements ERP-grade status transitions with:
 * - Guards to prevent invalid transitions
 * - Role-based permissions
 * - Audit trail logging
 * - Posting/locking behavior
 */

import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { InventoryMovement } from "@/lib/models/InventoryMovement";
import { StockItem } from "@/lib/models/StockItem";
import { User } from "@/lib/models/User";
import { Types } from "mongoose";

import {
  POStatus,
  GRVStatus,
  SupplierBillStatus,
  SupplierPaymentStatus,
  PO_STATUS_TRANSITIONS,
  GRV_STATUS_TRANSITIONS,
  BILL_STATUS_TRANSITIONS,
  PAYMENT_STATUS_TRANSITIONS,
  Permission,
  hasPermission,
  AuditAction,
  CreateAuditEntryParams,
} from "@/lib/types/p2p-status";

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

export interface TransitionResult extends ServiceResult {
  previousStatus?: string;
  newStatus?: string;
}

// ============================================================================
// GUARDS
// ============================================================================

/**
 * Check if a status transition is valid
 */
function canTransition(
  currentStatus: string,
  targetStatus: string,
  transitions: Record<string, string[]>
): boolean {
  const allowedTransitions = transitions[currentStatus];
  return allowedTransitions?.includes(targetStatus) || false;
}

/**
 * Guard: Check if document affects financials (is locked)
 */
export function isLocked(
  docType: "PO" | "GRV" | "SupplierBill" | "SupplierPayment",
  status: string
): boolean {
  const lockedStatuses: Record<string, string[]> = {
    PO: [POStatus.SUBMITTED, POStatus.APPROVED, POStatus.SENT, POStatus.PARTIALLY_RECEIVED, POStatus.FULLY_RECEIVED, POStatus.CLOSED],
    GRV: [GRVStatus.POSTED, GRVStatus.VOIDED],
    SupplierBill: [SupplierBillStatus.MATCHING_REQUIRED, SupplierBillStatus.APPROVED, SupplierBillStatus.PARTIALLY_PAID, SupplierBillStatus.PAID, SupplierBillStatus.VOIDED],
    SupplierPayment: [SupplierPaymentStatus.POSTED, SupplierPaymentStatus.VOIDED],
  };
  
  return lockedStatuses[docType]?.includes(status) || false;
}

/**
 * Guard: Check if document can be edited
 */
export function canEdit(
  docType: "PO" | "GRV" | "SupplierBill" | "SupplierPayment",
  status: string
): boolean {
  const editableStatuses: Record<string, string[]> = {
    PO: [POStatus.DRAFT],
    GRV: [GRVStatus.DRAFT],
    SupplierBill: [SupplierBillStatus.DRAFT],
    SupplierPayment: [SupplierPaymentStatus.DRAFT],
  };
  
  return editableStatuses[docType]?.includes(status) || false;
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

const auditCache: CreateAuditEntryParams[] = [];

/**
 * Log an audit entry (batched for performance)
 */
export async function logAuditEntry(params: CreateAuditEntryParams): Promise<void> {
  // In production, this would write to the database
  // For now, we cache and could flush to DB
  const entry = {
    ...params,
    timestamp: new Date(),
  };
  
  auditCache.push(entry);
  
  // Log to console in development
  console.log("[AUDIT]", {
    docType: params.docType,
    docNumber: params.docNumber,
    action: params.action,
    userId: params.userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Flush audit cache to database
 */
export async function flushAuditLog(): Promise<void> {
  if (auditCache.length === 0) return;
  
  // In production, bulk insert to Audit collection
  // const Audit = (await import("@/lib/models/Audit")).Audit;
  // await Audit.insertMany(auditCache);
  
  auditCache.length = 0;
}

// ============================================================================
// PERMISSION CHECKER
// ============================================================================

/**
 * Check if user has permission for an action
 */
export async function checkPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  await dbConnect();
  
  const user = await User.findById(userId).select("role").lean();
  if (!user) return false;
  
  return hasPermission(user.role || "staff", permission);
}

// ============================================================================
// PURCHASE ORDER SERVICE
// ============================================================================

/**
 * Submit PO for approval
 */
export async function submitPO(
  poId: string,
  userId: string,
  userRole: string
): Promise<TransitionResult> {
  // Permission check
  if (!await checkPermission(userId, Permission.PO_SUBMIT)) {
    return { success: false, error: "Insufficient permissions to submit PO" };
  }
  
  await dbConnect();
  
  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { success: false, error: "Purchase Order not found" };
  }
  
  // Guard: Check if can edit
  if (!canEdit("PO", po.status)) {
    return { success: false, error: `Cannot submit PO with status ${po.status}` };
  }
  
  // Guard: Check transition
  if (!canTransition(po.status, POStatus.SUBMITTED, PO_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot transition from ${po.status} to SUBMITTED` };
  }
  
  // Guard: Require at least one line
  if (!po.lines || po.lines.length === 0) {
    return { success: false, error: "PO must have at least one line item" };
  }
  
  const previousStatus = po.status;
  po.status = POStatus.SUBMITTED;
  po.updatedBy = new Types.ObjectId(userId);
  await po.save();
  
  // Audit
  await logAuditEntry({
    docType: "PO",
    docId: po._id,
    docNumber: po.poNumber,
    action: AuditAction.SUBMIT,
    userId,
    userRole,
    screen: "PurchaseOrders",
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: po.status,
  };
}

/**
 * Approve PO
 */
export async function approvePO(
  poId: string,
  userId: string,
  userRole: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.PO_APPROVE)) {
    return { success: false, error: "Insufficient permissions to approve PO" };
  }
  
  await dbConnect();
  
  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { success: false, error: "Purchase Order not found" };
  }
  
  if (!canTransition(po.status, POStatus.APPROVED, PO_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot transition from ${po.status} to APPROVED` };
  }
  
  const previousStatus = po.status;
  po.status = POStatus.APPROVED;
  po.updatedBy = new Types.ObjectId(userId);
  await po.save();
  
  await logAuditEntry({
    docType: "PO",
    docId: po._id,
    docNumber: po.poNumber,
    action: AuditAction.APPROVE,
    userId,
    userRole,
    screen: "PurchaseOrders",
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: po.status,
  };
}

/**
 * Cancel PO
 */
export async function cancelPO(
  poId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.PO_CANCEL)) {
    return { success: false, error: "Insufficient permissions to cancel PO" };
  }
  
  await dbConnect();
  
  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { success: false, error: "Purchase Order not found" };
  }
  
  // Guard: Cannot cancel if fully received
  if (po.status === POStatus.FULLY_RECEIVED || po.status === POStatus.CLOSED) {
    return { success: false, error: "Cannot cancel a fully received or closed PO" };
  }
  
  if (!canTransition(po.status, POStatus.CANCELLED, PO_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot cancel PO with status ${po.status}` };
  }
  
  const previousStatus = po.status;
  po.status = POStatus.CANCELLED;
  po.updatedBy = new Types.ObjectId(userId);
  po.notes = (po.notes || "") + `\n[CANCELLED: ${reason}]`;
  await po.save();
  
  await logAuditEntry({
    docType: "PO",
    docId: po._id,
    docNumber: po.poNumber,
    action: AuditAction.CANCEL,
    userId,
    userRole,
    screen: "PurchaseOrders",
    reason,
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: po.status,
  };
}

// ============================================================================
// GRV SERVICE
// ============================================================================

/**
 * Post GRV (affects stock)
 */
export async function postGRV(
  grvId: string,
  userId: string,
  userRole: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.GRV_POST)) {
    return { success: false, error: "Insufficient permissions to post GRV" };
  }
  
  await dbConnect();
  
  const grv = await GRV.findById(grvId);
  if (!grv) {
    return { success: false, error: "GRV not found" };
  }
  
  if (!canTransition(grv.status, GRVStatus.POSTED, GRV_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot post GRV with status ${grv.status}` };
  }
  
  // Guard: Require at least one line
  if (!grv.lines || grv.lines.length === 0) {
    return { success: false, error: "GRV must have at least one line item" };
  }
  
  const previousStatus = grv.status;
  
  // Start transaction
  const session = await (await import("@/lib/db")).dbConnect().then(() => 
    require("mongoose").startSession()
  );
  session.startTransaction();
  
  try {
    // Update GRV status
    grv.status = GRVStatus.POSTED;
    grv.postedAt = new Date();
    grv.postedBy = new Types.ObjectId(userId);
    grv.updatedBy = new Types.ObjectId(userId);
    await grv.save({ session });
    
    // Create inventory movements for each line
    for (const line of grv.lines) {
      await InventoryMovement.create([{
        companyId: grv.companyId,
        stockItemId: line.stockItemId,
        type: "RECEIPT",
        referenceType: "GRV",
        referenceId: grv._id,
        referenceNumber: grv.grvNumber,
        quantity: line.receivedQty,
        unitCostCents: line.unitCostCents,
        locationId: grv.locationId,
        notes: `Received via GRV ${grv.grvNumber}`,
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });
      
      // Update stock item quantity
      await StockItem.updateOne(
        { _id: line.stockItemId },
        { $inc: { quantity: line.receivedQty } },
        { session }
      );
    }
    
    // Update linked PO status if exists
    if (grv.poId) {
      await PurchaseOrder.updateOne(
        { _id: grv.poId },
        { $set: { status: POStatus.PARTIALLY_RECEIVED } },
        { session }
      );
    }
    
    await session.commitTransaction();
  } catch (error: any) {
    await session.abortTransaction();
    return { success: false, error: `Failed to post GRV: ${error.message}` };
  } finally {
    session.endSession();
  }
  
  await logAuditEntry({
    docType: "GRV",
    docId: grv._id,
    docNumber: grv.grvNumber,
    action: AuditAction.POST,
    userId,
    userRole,
    screen: "GRVs",
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: grv.status,
  };
}

/**
 * Void GRV with reversal (requires reason)
 */
export async function voidGRVWithReversal(
  grvId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.GRV_VOID)) {
    return { success: false, error: "Insufficient permissions to void GRV" };
  }
  
  await dbConnect();
  
  const grv = await GRV.findById(grvId);
  if (!grv) {
    return { success: false, error: "GRV not found" };
  }
  
  if (!canTransition(grv.status, GRVStatus.VOIDED, GRV_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot void GRV with status ${grv.status}` };
  }
  
  if (!reason) {
    return { success: false, error: "Reason is required when voiding a GRV" };
  }
  
  const previousStatus = grv.status;
  
  // Reverse inventory movements
  const session = await require("mongoose").startSession();
  session.startTransaction();
  
  try {
    // Reverse stock quantities
    for (const line of grv.lines) {
      await StockItem.updateOne(
        { _id: line.stockItemId },
        { $inc: { quantity: -line.receivedQty } },
        { session }
      );
      
      // Create reversal movement
      await InventoryMovement.create([{
        companyId: grv.companyId,
        stockItemId: line.stockItemId,
        type: "RECEIPT_REVERSAL",
        referenceType: "GRV",
        referenceId: grv._id,
        referenceNumber: grv.grvNumber,
        quantity: -line.receivedQty,
        unitCostCents: line.unitCostCents,
        notes: `Reversed: ${reason}`,
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });
    }
    
    // Update GRV status
    grv.status = GRVStatus.VOIDED;
    grv.notes = (grv.notes || "") + `\n[VOIDED: ${reason}]`;
    grv.updatedBy = new Types.ObjectId(userId);
    await grv.save({ session });
    
    await session.commitTransaction();
  } catch (error: any) {
    await session.abortTransaction();
    return { success: false, error: `Failed to void GRV: ${error.message}` };
  } finally {
    session.endSession();
  }
  
  await logAuditEntry({
    docType: "GRV",
    docId: grv._id,
    docNumber: grv.grvNumber,
    action: AuditAction.VOID,
    userId,
    userRole,
    screen: "GRVs",
    reason,
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: grv.status,
  };
}

// ============================================================================
// SUPPLIER BILL SERVICE
// ============================================================================

/**
 * Approve Bill (affects AP)
 */
export async function approveBill(
  billId: string,
  userId: string,
  userRole: string,
  override: boolean = false,
  overrideReason?: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.BILL_APPROVE)) {
    return { success: false, error: "Insufficient permissions to approve Bill" };
  }
  
  await dbConnect();
  
  const bill = await SupplierBill.findById(billId);
  if (!bill) {
    return { success: false, error: "Supplier Bill not found" };
  }
  
  if (!canTransition(bill.status, SupplierBillStatus.APPROVED, BILL_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot approve Bill with status ${bill.status}` };
  }
  
  // Guard: Require matching (or override)
  if (!override && bill.status === SupplierBillStatus.MATCHING_REQUIRED) {
    return { 
      success: false, 
      error: "Bill requires matching verification. Use override if authorized." 
    };
  }
  
  const previousStatus = bill.status;
  bill.status = SupplierBillStatus.APPROVED;
  bill.postedAt = new Date();
  bill.postedBy = new Types.ObjectId(userId);
  bill.updatedBy = new Types.ObjectId(userId);
  
  if (override && overrideReason) {
    bill.notes = (bill.notes || "") + `\n[MATCHING_OVERRIDE: ${overrideReason}]`;
  }
  
  await bill.save();
  
  await logAuditEntry({
    docType: "SupplierBill",
    docId: bill._id,
    docNumber: bill.billNumber,
    action: AuditAction.APPROVE,
    userId,
    userRole,
    screen: "SupplierBills",
    override,
    overrideReason,
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: bill.status,
  };
}

/**
 * Void Bill with reversal
 */
export async function voidBillWithReversal(
  billId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.BILL_VOID)) {
    return { success: false, error: "Insufficient permissions to void Bill" };
  }
  
  await dbConnect();
  
  const bill = await SupplierBill.findById(billId);
  if (!bill) {
    return { success: false, error: "Supplier Bill not found" };
  }
  
  if (!canTransition(bill.status, SupplierBillStatus.VOIDED, BILL_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot void Bill with status ${bill.status}` };
  }
  
  if (!reason) {
    return { success: false, error: "Reason is required when voiding a Bill" };
  }
  
  // Guard: Cannot void if fully paid - must reverse payments first
  if (bill.status === SupplierBillStatus.PAID) {
    return { 
      success: false, 
      error: "Cannot void a paid Bill. Reverse payments first." 
    };
  }
  
  const previousStatus = bill.status;
  
  // Reverse any partial payments
  if (bill.paidCents && bill.paidCents > 0) {
    // This would create a contra entry or reversal
    // Simplified for this implementation
  }
  
  bill.status = SupplierBillStatus.VOIDED;
  bill.voidedAt = new Date();
  bill.voidedBy = new Types.ObjectId(userId);
  bill.notes = (bill.notes || "") + `\n[VOIDED: ${reason}]`;
  bill.updatedBy = new Types.ObjectId(userId);
  await bill.save();
  
  await logAuditEntry({
    docType: "SupplierBill",
    docId: bill._id,
    docNumber: bill.billNumber,
    action: AuditAction.VOID,
    userId,
    userRole,
    screen: "SupplierBills",
    reason,
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: bill.status,
  };
}

// ============================================================================
// SUPPLIER PAYMENT SERVICE
// ============================================================================

/**
 * Post Payment (affects cash/AP)
 */
export async function postPayment(
  paymentId: string,
  userId: string,
  userRole: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.PAYMENT_POST)) {
    return { success: false, error: "Insufficient permissions to post Payment" };
  }
  
  await dbConnect();
  
  const payment = await SupplierPayment.findById(paymentId);
  if (!payment) {
    return { success: false, error: "Supplier Payment not found" };
  }
  
  if (!canTransition(payment.status, SupplierPaymentStatus.POSTED, PAYMENT_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot post Payment with status ${payment.status}` };
  }
  
  const previousStatus = payment.status;
  
  // Update linked bills
  if (payment.allocations && payment.allocations.length > 0) {
    for (const alloc of payment.allocations) {
      const bill = await SupplierBill.findById(alloc.supplierBillId);
      if (bill) {
        const newPaidCents = (bill.paidCents || 0) + alloc.amountCents;
        const newStatus = newPaidCents >= bill.totalCents 
          ? SupplierBillStatus.PAID 
          : SupplierBillStatus.PARTIALLY_PAID;
        
        await SupplierBill.updateOne(
          { _id: bill._id },
          { $set: { paidCents: newPaidCents, status: newStatus } }
        );
      }
    }
  }
  
  payment.status = SupplierPaymentStatus.POSTED;
  payment.postedAt = new Date();
  payment.updatedBy = new Types.ObjectId(userId);
  await payment.save();
  
  await logAuditEntry({
    docType: "SupplierPayment",
    docId: payment._id,
    docNumber: payment.paymentNumber,
    action: AuditAction.POST,
    userId,
    userRole,
    screen: "SupplierPayments",
  });
  
  return {
    success: true,
    previousStatus,
    newStatus: payment.status,
  };
}

/**
 * Void Payment with reversal
 */
export async function voidPaymentWithReversal(
  paymentId: string,
  userId: string,
  userRole: string,
  reason: string
): Promise<TransitionResult> {
  if (!await checkPermission(userId, Permission.PAYMENT_VOID)) {
    return { success: false, error: "Insufficient permissions to void Payment" };
  }
  
  await dbConnect();
  
  const payment = await SupplierPayment.findById(paymentId);
  if (!payment) {
    return { success: false, error: "Supplier Payment not found" };
  }
  
  if (!canTransition(payment.status, SupplierPaymentStatus.VOIDED, PAYMENT_STATUS_TRANSITIONS)) {
    return { success: false, error: `Cannot void Payment with status ${payment.status}` };
  }
  
  if (!reason) {
    return { success: false, error: "Reason is required when voiding a Payment" };
  }
  
  const previousStatus = payment.status;
  
  // Reverse bill allocations
  if (payment.allocations && payment.allocations.length > 0) {
    for (const alloc of payment.allocations) {
      const bill = await SupplierBill.findById(alloc.supplierBillId);
      if (bill) {
        const newPaidCents = Math.max(0, (bill.paidCents || 0) - alloc.amountCents);
        const newStatus = newPaidCents === 0 
          ? SupplierBillStatus.APPROVED 
          : SupplierBillStatus.PARTIALLY_PAID;
        
        await SupplierBill.updateOne(
          { _id: bill._id },
          { $set: { paidCents: newPaidCents, status: newStatus } }
        );
      }
    }
  }
  
  payment.status = SupplierPaymentStatus.VOIDED;
  payment.notes = (payment.notes || "") + `\n[VOIDED: ${reason}]`;
  payment.updatedBy = new Types.ObjectId(userId);
  await payment.save();
  
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
  
  return {
    success: true,
    previousStatus,
    newStatus: payment.status,
  };
}

// ============================================================================
// EDIT GUARDS (prevent edits after financial impact)
// ============================================================================

/**
 * Check if document fields can be edited
 */
export function canEditField(
  docType: "PO" | "GRV" | "SupplierBill" | "SupplierPayment",
  status: string,
  field: string
): { canEdit: boolean; reason?: string } {
  // Always allow editing these fields
  const alwaysEditable = ["notes", "reference"];
  if (alwaysEditable.includes(field)) {
    return { canEdit: true };
  }
  
  // Check if document is locked
  if (isLocked(docType, status)) {
    return { 
      canEdit: false, 
      reason: `Cannot edit ${field} - document is ${status}` 
    };
  }
  
  return { canEdit: true };
}

/**
 * Validate edit request
 */
export function validateEdit<T extends Record<string, any>>(
  docType: "PO" | "GRV" | "SupplierBill" | "SupplierPayment",
  currentStatus: string,
  updates: T,
  allowedFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const field of Object.keys(updates)) {
    if (!allowedFields.includes(field)) {
      const check = canEditField(docType, currentStatus, field);
      if (!check.canEdit) {
        errors.push(check.reason || `Cannot edit ${field}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

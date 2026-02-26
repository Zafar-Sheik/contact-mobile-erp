/**
 * ERP-Grade P2P Status Definitions
 * 
 * Implements the standard PO → Receipt → Invoice (3-way match) workflow:
 * 
 * Purchase Order:
 * DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY_RECEIVED → CLOSED | CANCELLED
 * 
 * GRV (Goods Received Voucher):
 * DRAFT → POSTED | VOIDED
 * 
 * Supplier Bill:
 * DRAFT → MATCHING_REQUIRED → APPROVED → PARTIALLY_PAID → PAID | VOIDED
 * 
 * Supplier Payment:
 * DRAFT → POSTED | VOIDED
 */

import { Types } from "mongoose";

// ============================================================================
// STATUS ENUMS
// ============================================================================

/** Purchase Order statuses */
export enum POStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  SENT = "SENT",
  PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED",
  FULLY_RECEIVED = "FULLY_RECEIVED",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED",
}

/** GRV statuses */
export enum GRVStatus {
  DRAFT = "DRAFT",
  POSTED = "POSTED",
  VOIDED = "VOIDED",
}

/** Supplier Bill statuses */
export enum SupplierBillStatus {
  DRAFT = "DRAFT",
  MATCHING_REQUIRED = "MATCHING_REQUIRED",
  APPROVED = "APPROVED",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  VOIDED = "VOIDED",
}

/** Supplier Payment statuses */
export enum SupplierPaymentStatus {
  DRAFT = "DRAFT",
  POSTED = "POSTED",
  VOIDED = "VOIDED",
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

/** Valid status transitions for each document type */
export const PO_STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  [POStatus.DRAFT]: [POStatus.SUBMITTED, POStatus.CANCELLED],
  [POStatus.SUBMITTED]: [POStatus.APPROVED, POStatus.CANCELLED],
  [POStatus.APPROVED]: [POStatus.SENT, POStatus.CANCELLED],
  [POStatus.SENT]: [POStatus.PARTIALLY_RECEIVED, POStatus.CLOSED, POStatus.CANCELLED],
  [POStatus.PARTIALLY_RECEIVED]: [POStatus.FULLY_RECEIVED, POStatus.CLOSED, POStatus.CANCELLED],
  [POStatus.FULLY_RECEIVED]: [POStatus.CLOSED],
  [POStatus.CLOSED]: [],
  [POStatus.CANCELLED]: [],
};

export const GRV_STATUS_TRANSITIONS: Record<GRVStatus, GRVStatus[]> = {
  [GRVStatus.DRAFT]: [GRVStatus.POSTED, GRVStatus.VOIDED],
  [GRVStatus.POSTED]: [GRVStatus.VOIDED],
  [GRVStatus.VOIDED]: [],
};

export const BILL_STATUS_TRANSITIONS: Record<SupplierBillStatus, SupplierBillStatus[]> = {
  [SupplierBillStatus.DRAFT]: [SupplierBillStatus.MATCHING_REQUIRED, SupplierBillStatus.VOIDED],
  [SupplierBillStatus.MATCHING_REQUIRED]: [SupplierBillStatus.APPROVED, SupplierBillStatus.VOIDED],
  [SupplierBillStatus.APPROVED]: [SupplierBillStatus.PARTIALLY_PAID, SupplierBillStatus.PAID, SupplierBillStatus.VOIDED],
  [SupplierBillStatus.PARTIALLY_PAID]: [SupplierBillStatus.PAID, SupplierBillStatus.VOIDED],
  [SupplierBillStatus.PAID]: [SupplierBillStatus.VOIDED],
  [SupplierBillStatus.VOIDED]: [],
};

export const PAYMENT_STATUS_TRANSITIONS: Record<SupplierPaymentStatus, SupplierPaymentStatus[]> = {
  [SupplierPaymentStatus.DRAFT]: [SupplierPaymentStatus.POSTED, SupplierPaymentStatus.VOIDED],
  [SupplierPaymentStatus.POSTED]: [SupplierPaymentStatus.VOIDED],
  [SupplierPaymentStatus.VOIDED]: [],
};

// ============================================================================
// FINANCIAL IMPACT FLAGS
// ============================================================================

/** Documents that affect stock and AP when POSTED */
export const AFFECTS_STOCK_AND_AP: Record<string, GRVStatus | SupplierBillStatus | SupplierPaymentStatus> = {
  GRV: GRVStatus.POSTED,
  SupplierBill: SupplierBillStatus.APPROVED,
  SupplierPayment: SupplierPaymentStatus.POSTED,
};

/** Check if a document status affects financials */
export function affectsFinancials(
  docType: "GRV" | "SupplierBill" | "SupplierPayment",
  status: string
): boolean {
  const affectingStatus = AFFECTS_STOCK_AND_AP[docType];
  return status === affectingStatus;
}

// ============================================================================
// ROLE PERMISSIONS
// ============================================================================

/** Required roles for each action */
export enum Permission {
  PO_CREATE = "po:create",
  PO_SUBMIT = "po:submit",
  PO_APPROVE = "po:approve",
  PO_CANCEL = "po:cancel",
  
  GRV_CREATE = "grv:create",
  GRV_POST = "grv:post",
  GRV_VOID = "grv:void",
  
  BILL_CREATE = "bill:create",
  BILL_APPROVE = "bill:approve",
  BILL_MATCH = "bill:match",
  BILL_VOID = "bill:void",
  
  PAYMENT_CREATE = "payment:create",
  PAYMENT_POST = "payment:post",
  PAYMENT_VOID = "payment:void",
  
  VIEW_REPORTS = "reports:view",
  MANAGE_SUPPLIERS = "suppliers:manage",
}

/** Role to permissions mapping */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Basic staff - can create documents, submit for approval
  staff: [
    Permission.PO_CREATE,
    Permission.GRV_CREATE,
    Permission.BILL_CREATE,
    Permission.PAYMENT_CREATE,
  ],
  
  // Supervisor - can approve and post
  supervisor: [
    Permission.PO_CREATE,
    Permission.PO_SUBMIT,
    Permission.PO_APPROVE,
    Permission.GRV_CREATE,
    Permission.GRV_POST,
    Permission.BILL_CREATE,
    Permission.BILL_APPROVE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_POST,
    Permission.VIEW_REPORTS,
  ],
  
  // Manager - can do everything including void
  manager: [
    Permission.PO_CREATE,
    Permission.PO_SUBMIT,
    Permission.PO_APPROVE,
    Permission.PO_CANCEL,
    Permission.GRV_CREATE,
    Permission.GRV_POST,
    Permission.GRV_VOID,
    Permission.BILL_CREATE,
    Permission.BILL_APPROVE,
    Permission.BILL_MATCH,
    Permission.BILL_VOID,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_POST,
    Permission.PAYMENT_VOID,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_SUPPLIERS,
  ],
  
  // Admin - full access
  admin: Object.values(Permission),
};

/** Check if a role has a specific permission */
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission) || permissions.includes(Permission.VIEW_REPORTS as any);
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/** Audit action types */
export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  SUBMIT = "SUBMIT",
  APPROVE = "APPROVE",
  POST = "POST",
  VOID = "VOID",
  CANCEL = "CANCEL",
  MATCH = "MATCH",
  ALLOCATE = "ALLOCATE",
}

/** Audit trail entry */
export interface AuditEntry {
  _id?: Types.ObjectId;
  
  // Document reference
  docType: "PO" | "GRV" | "SupplierBill" | "SupplierPayment";
  docId: Types.ObjectId;
  docNumber: string;
  
  // Action details
  action: AuditAction;
  field?: string;
  oldValue?: any;
  newValue?: any;
  
  // User reference
  userId: Types.ObjectId;
  userName?: string;
  userRole?: string;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  screen?: string;  // Which screen the action was performed from
  
  // Metadata
  timestamp: Date;
  reason?: string;  // Required for void/cancel with reversal
  override?: boolean;  // If override was used (e.g., matching override)
  overrideReason?: string;
}

/** Create audit entry data */
export interface CreateAuditEntryParams {
  docType: "PO" | "GRV" | "SupplierBill" | "SupplierPayment";
  docId: string | Types.ObjectId;
  docNumber: string;
  action: AuditAction;
  userId: string | Types.ObjectId;
  userName?: string;
  userRole?: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  screen?: string;
  reason?: string;
  override?: boolean;
  overrideReason?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}

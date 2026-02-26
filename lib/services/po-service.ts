/**
 * Purchase Order Service
 * 
 * Service layer for PO operations:
 * - CRUD operations
 * - Status transitions (submit, approve, cancel)
 * - Pagination and filtering
 */

import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { Counter } from "@/lib/models/Counter";
import { Types } from "mongoose";

import { POStatus } from "@/lib/types/p2p-status";
import { logAuditEntry } from "./p2p-service";
import { AuditAction } from "@/lib/types/p2p-status";

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface POListFilters {
  status?: string;
  supplierId?: string;
  q?: string;
  fromDate?: Date;
  toDate?: Date;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List Purchase Orders with pagination and filtering
 */
export async function listPurchaseOrders(
  companyId: string,
  filters: POListFilters = {},
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResult<any>> {
  await dbConnect();

  const query: any = { companyId, isDeleted: false };

  // Apply filters
  if (filters.status) {
    // Handle comma-separated status values (e.g., "Issued,PartiallyReceived")
    const statuses = filters.status.split(",").map(s => s.trim());
    
    // Map frontend status values to database values
    const statusMap: Record<string, string> = {
      "Issued": "SENT",
      "PartiallyReceived": "PARTIALLY_RECEIVED",
      "FullyReceived": "FULLY_RECEIVED",
      "Draft": "DRAFT",
      "Closed": "CLOSED",
      "Cancelled": "CANCELLED"
    };
    
    const mappedStatuses = statuses.map(s => statusMap[s] || s);
    
    if (mappedStatuses.length > 1) {
      query.status = { $in: mappedStatuses };
    } else {
      query.status = mappedStatuses[0];
    }
  }

  if (filters.supplierId) {
    query.supplierId = filters.supplierId;
  }

  if (filters.q) {
    query.$or = [
      { poNumber: { $regex: filters.q, $options: "i" } },
      { notes: { $regex: filters.q, $options: "i" } },
    ];
  }

  if (filters.fromDate || filters.toDate) {
    query.createdAt = {};
    if (filters.fromDate) query.createdAt.$gte = filters.fromDate;
    if (filters.toDate) query.createdAt.$lte = filters.toDate;
  }

  // Get total count
  const total = await PurchaseOrder.countDocuments(query);

  // Get paginated results
  const orders = await PurchaseOrder.find(query)
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Transform
  const data = orders.map((order: any) => ({
    _id: order._id,
    poNumber: order.poNumber,
    supplierId: order.supplierId?._id || order.supplierId,
    supplierName: order.supplierId?.name || "",
    date: order.createdAt,
    expectedDelivery: order.expectedAt,
    total: order.subtotalCents,
    status: order.status,
    notes: order.notes,
    isActive: !order.isDeleted,
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get single Purchase Order by ID
 */
export async function getPurchaseOrder(
  poId: string
): Promise<{ data?: any; error?: ServiceError }> {
  await dbConnect();

  const order = await PurchaseOrder.findById(poId)
    .populate("supplierId", "name email phone")
    .populate("lines.stockItemId", "name sku unit")
    .lean();

  if (!order) {
    return {
      error: {
        code: "NOT_FOUND",
        message: "Purchase Order not found",
      },
    };
  }

  return {
    data: order,
  };
}

/**
 * Create Purchase Order
 */
export async function createPurchaseOrder(
  data: {
    supplierId: string;
    expectedAt?: Date;
    notes?: string;
    lines: Array<{
      stockItemId: string;
      description: string;
      orderedQty: number;
      unitCostCents: number;
    }>;
  },
  userId: string,
  companyId: string
): Promise<{ data?: any; error?: ServiceError }> {
  await dbConnect();

  // Validate supplier
  if (!data.supplierId) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Supplier is required",
      },
    };
  }

  // Generate PO number
  const counter = await Counter.findOneAndUpdate(
    { companyId, key: "PO", isDeleted: false },
    { $inc: { nextNumber: 1 } },
    { upsert: true, new: true }
  );

  const poNumber = `PO-${String(counter.nextNumber).padStart(6, "0")}`;

  // Calculate totals
  let subtotalCents = 0;
  const lines = data.lines?.map((line, index) => {
    const lineTotal = (line.orderedQty || 0) * (line.unitCostCents || 0);
    subtotalCents += lineTotal;

    return {
      lineNo: index + 1,
      stockItemId: line.stockItemId,
      description: line.description,
      orderedQty: line.orderedQty,
      receivedQty: 0,
      unitCostCents: line.unitCostCents,
      subtotalCents: lineTotal,
    };
  }) || [];

  // Create PO
  const order = await PurchaseOrder.create({
    companyId,
    poNumber,
    supplierId: data.supplierId,
    status: POStatus.DRAFT,
    expectedAt: data.expectedAt,
    notes: data.notes || "",
    lines,
    subtotalCents,
    createdBy: new Types.ObjectId(userId),
    updatedBy: new Types.ObjectId(userId),
  });

  await order.populate("supplierId", "name email phone");

  // Audit
  await logAuditEntry({
    docType: "PO",
    docId: order._id,
    docNumber: order.poNumber,
    action: AuditAction.CREATE,
    userId,
    screen: "PurchaseOrders",
  });

  return {
    data: {
      _id: order._id,
      poNumber: order.poNumber,
      supplierId: (order.supplierId as any)?._id || order.supplierId,
      supplierName: (order.supplierId as any)?.name || "",
      date: order.createdAt,
      expectedDelivery: order.expectedAt,
      total: order.subtotalCents,
      status: order.status,
      notes: order.notes,
    },
  };
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

/**
 * Submit PO for approval
 */
export async function submitPO(
  poId: string,
  userId: string,
  userRole: string
): Promise<{ data?: any; error?: ServiceError }> {
  await dbConnect();

  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { error: { code: "NOT_FOUND", message: "PO not found" } };
  }

  // Validation
  if (po.status !== POStatus.DRAFT) {
    return {
      error: {
        code: "INVALID_STATUS",
        message: `Cannot submit PO in ${po.status} status`,
      },
    };
  }

  if (!po.lines || po.lines.length === 0) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "PO must have at least one line item",
      },
    };
  }

  const previousStatus = po.status;
  po.status = POStatus.SUBMITTED;
  po.updatedBy = new Types.ObjectId(userId);
  await po.save();

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
    data: {
      _id: po._id,
      poNumber: po.poNumber,
      status: po.status,
      previousStatus,
    },
  };
}

/**
 * Approve PO
 */
export async function approvePO(
  poId: string,
  userId: string,
  userRole: string
): Promise<{ data?: any; error?: ServiceError }> {
  await dbConnect();

  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { error: { code: "NOT_FOUND", message: "PO not found" } };
  }

  // Validation
  const allowedStatuses = [POStatus.SUBMITTED];
  if (!allowedStatuses.includes(po.status as POStatus)) {
    return {
      error: {
        code: "INVALID_STATUS",
        message: `Cannot approve PO in ${po.status} status`,
      },
    };
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
    data: {
      _id: po._id,
      poNumber: po.poNumber,
      status: po.status,
      previousStatus,
    },
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
): Promise<{ data?: any; error?: ServiceError }> {
  await dbConnect();

  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { error: { code: "NOT_FOUND", message: "PO not found" } };
  }

  // Validation - can't cancel fully received or closed
  const nonCancellable = [POStatus.FULLY_RECEIVED, POStatus.CLOSED];
  if (nonCancellable.includes(po.status as POStatus)) {
    return {
      error: {
        code: "INVALID_STATUS",
        message: `Cannot cancel PO in ${po.status} status`,
      },
    };
  }

  const previousStatus = po.status;
  po.status = POStatus.CANCELLED;
  po.notes = (po.notes || "") + `\n[CANCELLED: ${reason}]`;
  po.updatedBy = new Types.ObjectId(userId);
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
    data: {
      _id: po._id,
      poNumber: po.poNumber,
      status: po.status,
      previousStatus,
    },
  };
}

/**
 * Delete (soft delete) PO
 */
export async function deletePO(
  poId: string,
  userId: string
): Promise<{ data?: any; error?: ServiceError }> {
  await dbConnect();

  const po = await PurchaseOrder.findById(poId);
  if (!po) {
    return { error: { code: "NOT_FOUND", message: "PO not found" } };
  }

  // Can only delete in DRAFT status
  if (po.status !== POStatus.DRAFT) {
    return {
      error: {
        code: "INVALID_STATUS",
        message: "Can only delete PO in DRAFT status",
      },
    };
  }

  po.isDeleted = true;
  po.deletedAt = new Date();
  po.updatedBy = new Types.ObjectId(userId);
  await po.save();

  return {
    data: { success: true },
  };
}

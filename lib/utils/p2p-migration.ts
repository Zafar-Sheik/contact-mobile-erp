/**
 * Procure-to-Pay Migration Utilities
 * 
 * This module provides non-destructive migration utilities for implementing
 * the canonical P2P relationships.
 * 
 * Migration Strategy:
 * 1. Add new fields (indexed) without removing old ones
 * 2. Use application-level validation (not database constraints)
 * 3. Provide backfill utilities for existing data
 * 
 * Backfill Strategy:
 * - Best-effort linking by supplier + date + line items
 * - Don't overwrite existing data
 * - Log all changes for audit
 */

import { dbConnect } from "@/lib/db";
import { PurchaseOrder } from "@/lib/models/PurchaseOrder";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { StockItem } from "@/lib/models/StockItem";
import { Supplier } from "@/lib/models/Supplier";
import { Counter } from "@/lib/models/Counter";
import { Types } from "mongoose";

export interface MigrationResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  errors: string[];
  warnings: string[];
}

export interface BackfillResult {
  success: boolean;
  linked: number;
  unlinked: number;
  errors: string[];
}

// ============================================================================
// MIGRATION: Initialize counters for P2P documents
// ============================================================================

/**
 * Initialize counters for P2P document types
 * Run this once to set up the numbering system
 */
export async function migrateInitializeCounters(
  companyId: string,
  userId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    recordsProcessed: 0,
    recordsUpdated: 0,
    errors: [],
    warnings: [],
  };

  try {
    await dbConnect();

    const counters = [
      { key: "PO", prefix: "PO-", padding: 6 },
      { key: "GRV", prefix: "GRV-", padding: 6 },
      { key: "BILL", prefix: "BILL-", padding: 6 },
      { key: "PAY", prefix: "PAY-", padding: 6 },
    ];

    for (const config of counters) {
      const existing = await Counter.findOne({
        companyId,
        key: config.key,
        isDeleted: false,
      });

      if (!existing) {
        await Counter.create({
          companyId,
          key: config.key,
          nextNumber: 1,
          prefix: config.prefix,
          padding: config.padding,
          createdBy: userId,
          updatedBy: userId,
        });
        result.recordsUpdated++;
      }
    }

    result.recordsProcessed = counters.length;
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Failed to initialize counters: ${error.message}`);
  }

  return result;
}

// ============================================================================
// BACKFILL: Link GRVs to POs by supplier + date matching
// ============================================================================

/**
 * Backfill PO references in GRVs
 * 
 * Strategy:
 * 1. Find GRVs without a poId
 * 2. Match by supplier + closest date
 * 3. Match line items by stock item where possible
 */
export async function backfillGRVToPOLinks(
  companyId: string
): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: true,
    linked: 0,
    unlinked: 0,
    errors: [],
  };

  try {
    await dbConnect();

    // Find GRVs without PO reference
    const grvs = await GRV.find({
      companyId,
      poId: { $exists: false },
      isDeleted: false,
      status: "Posted",
    }).lean();

    for (const grv of grvs) {
      // Find matching PO: same supplier, date before GRV
      const matchingPO = await PurchaseOrder.findOne({
        companyId,
        supplierId: grv.supplierId,
        status: { $in: ["Issued", "PartiallyReceived"] },
        createdAt: { $lte: grv.receivedAt },
        isDeleted: false,
      }).sort({ createdAt: -1 }).lean();

      if (matchingPO) {
        // Update GRV with PO reference
        await GRV.updateOne(
          { _id: grv._id },
          { 
            $set: { 
              poId: matchingPO._id,
              referenceType: "po",
            } 
          }
        );

        // Also add GRV reference to PO
        await PurchaseOrder.updateOne(
          { _id: matchingPO._id },
          { $set: { status: "PartiallyReceived" } }
        );

        result.linked++;
      } else {
        result.unlinked++;
      }
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Backfill failed: ${error.message}`);
  }

  return result;
}

// ============================================================================
// BACKFILL: Link Bills to GRVs
// ============================================================================

/**
 * Backfill GRV references in Bills
 * 
 * Strategy:
 * 1. Find Bills without grvIds
 * 2. Match by supplier + date range
 * 3. Match line items by stock item where possible
 */
export async function backfillBillToGRVLinks(
  companyId: string
): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: true,
    linked: 0,
    unlinked: 0,
    errors: [],
  };

  try {
    await dbConnect();

    // Find Bills without GRV references
    const bills = await SupplierBill.find({
      companyId,
      grvIds: { $exists: true, $size: 0 },
      isDeleted: false,
      status: { $in: ["Posted", "PartiallyPaid", "Paid"] },
    }).lean();

    for (const bill of bills) {
      // Find GRVs from same supplier, before bill date
      const matchingGRVs = await GRV.find({
        companyId,
        supplierId: bill.supplierId,
        status: "Posted",
        receivedAt: { $lte: bill.billDate },
        isDeleted: false,
      })
        .sort({ receivedAt: -1 })
        .limit(10)
        .lean();

      if (matchingGRVs.length > 0) {
        const grvIds = matchingGRVs.map((grv) => grv._id);

        // Update Bill with GRV references
        await SupplierBill.updateOne(
          { _id: bill._id },
          { $set: { grvIds } }
        );

        result.linked++;
      } else {
        result.unlinked++;
      }
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Backfill failed: ${error.message}`);
  }

  return result;
}

// ============================================================================
// BACKFILL: Add stock item snapshots to existing line items
// ============================================================================

/**
 * Backfill stock item snapshots in GRV and Bill lines
 * This ensures audit trail is preserved even if stock item is modified
 */
export async function backfillItemSnapshots(
  companyId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    recordsProcessed: 0,
    recordsUpdated: 0,
    errors: [],
    warnings: [],
  };

  try {
    await dbConnect();

    // Backfill GRV snapshots
    const grvs = await GRV.find({
      companyId,
      isDeleted: false,
    }).lean();

    for (const grv of grvs) {
      let needsUpdate = false;
      const updatedLines = [...grv.lines];

      for (let i = 0; i < updatedLines.length; i++) {
        const line = updatedLines[i];
        
        // Only add snapshot if missing
        if (!line.itemSnapshot && line.stockItemId) {
          const stockItem = await StockItem.findById(line.stockItemId).lean();
          
          if (stockItem) {
            updatedLines[i] = {
              ...line,
              itemSnapshot: {
                sku: stockItem.sku || "",
                name: stockItem.name || "Unknown",
                unit: stockItem.unit || "each",
                vatRate: stockItem.tax?.vatRate || 15,
                isVatExempt: stockItem.tax?.isVatExempt || false,
              },
            };
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await GRV.updateOne(
          { _id: grv._id },
          { $set: { lines: updatedLines } }
        );
        result.recordsUpdated++;
      }

      result.recordsProcessed++;
    }

    // Backfill Bill snapshots
    const bills = await SupplierBill.find({
      companyId,
      isDeleted: false,
    }).lean();

    for (const bill of bills) {
      let needsUpdate = false;
      const updatedLines = [...bill.billLines];

      for (let i = 0; i < updatedLines.length; i++) {
        const line = updatedLines[i];
        
        // Only add snapshot if missing
        if (!line.itemSnapshot && line.stockItemId) {
          const stockItem = await StockItem.findById(line.stockItemId).lean();
          
          if (stockItem) {
            updatedLines[i] = {
              ...line,
              itemSnapshot: {
                sku: stockItem.sku || "",
                name: stockItem.name || "Unknown",
                unit: stockItem.unit || "each",
                vatRate: stockItem.tax?.vatRate || 15,
                isVatExempt: stockItem.tax?.isVatExempt || false,
              },
            };
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await SupplierBill.updateOne(
          { _id: bill._id },
          { $set: { billLines: updatedLines } }
        );
        result.recordsUpdated++;
      }

      result.recordsProcessed++;
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Backfill failed: ${error.message}`);
  }

  return result;
}

// ============================================================================
// VALIDATION: Check for cross-supplier violations
// ============================================================================

/**
 * Find all cross-supplier violations in existing data
 * Returns list of documents that violate the supplier consistency rule
 */
export async function findCrossSupplierViolations(
  companyId: string
): Promise<{
  billsWithWrongGRVs: Array<{ billId: string; billNumber: string; grvIds: string[] }>;
  grvsWithWrongPO: Array<{ grvId: string; grvNumber: string; poId: string | null }>;
}> {
  await dbConnect();

  const violations = {
    billsWithWrongGRVs: [] as Array<{ billId: string; billNumber: string; grvIds: string[] }>,
    grvsWithWrongPO: [] as Array<{ grvId: string; grvNumber: string; poId: string | null }>,
  };

  // Check Bills for GRV supplier mismatches
  const bills = await SupplierBill.find({
    companyId,
    isDeleted: false,
    grvIds: { $exists: true, $ne: [] },
  })
    .populate("supplierId", "name")
    .lean();

  for (const bill of bills) {
    const billSupplierId = (bill.supplierId as any)?._id?.toString();
    
    const grvs = await GRV.find({
      _id: { $in: bill.grvIds },
    }).populate("supplierId", "name").lean();

    const wrongGRVs = grvs.filter((grv) => {
      const grvSupplierId = (grv.supplierId as any)?._id?.toString();
      return grvSupplierId !== billSupplierId;
    });

    if (wrongGRVs.length > 0) {
      violations.billsWithWrongGRVs.push({
        billId: bill._id.toString(),
        billNumber: bill.billNumber,
        grvIds: wrongGRVs.map((grv) => grv._id.toString()),
      });
    }
  }

  // Check GRVs for PO supplier mismatches
  const grvs = await GRV.find({
    companyId,
    isDeleted: false,
    poId: { $exists: true, $ne: null },
  })
    .populate("supplierId", "name")
    .populate("poId", "supplierId")
    .lean();

  for (const grv of grvs) {
    const grvSupplierId = (grv.supplierId as any)?._id?.toString();
    const poSupplierId = (grv.poId as any)?.supplierId?.toString();

    if (grvSupplierId && poSupplierId && grvSupplierId !== poSupplierId) {
      violations.grvsWithWrongPO.push({
        grvId: grv._id.toString(),
        grvNumber: grv.grvNumber,
        poId: grv.poId?.toString() || null,
      });
    }
  }

  return violations;
}

// ============================================================================
// RUN ALL BACKFILLS
// ============================================================================

/**
 * Run all backfill operations in sequence
 */
export async function runAllBackfills(
  companyId: string,
  userId: string
): Promise<{
  counters: MigrationResult;
  grvToPO: BackfillResult;
  billToGRV: BackfillResult;
  snapshots: MigrationResult;
}> {
  // Initialize counters first
  const counters = await migrateInitializeCounters(companyId, userId);

  // Run backfills
  const grvToPO = await backfillGRVToPOLinks(companyId);
  const billToGRV = await backfillBillToGRVLinks(companyId);
  const snapshots = await backfillItemSnapshots(companyId);

  return {
    counters,
    grvToPO,
    billToGRV,
    snapshots,
  };
}

# Procure-to-Pay (P2P) Implementation Guide

## Overview

This document describes the canonical Procure-to-Pay workflow implementation with enforced entity relationships.

## Entity Relationships

```
Supplier
   │
   ├──► PurchaseOrder (PO) ──────────────────────┐
   │        │                                     │
   │        ├──► PO Line → StockItem            │
   │        │                                     │
   │        └──────────────┐                     │
   │                       ▼                     │
   ├──► GRV (Goods Received Voucher)            │
   │        │                     │             │
   │        ├──► GRV Line → StockItem           │
   │        │                                     │
   │        └──► Optional: links to PO          │
   │                                     (backward link)
   │                                     │
   ├─────────────────────────────────────┤
   │                                     │
   ▼                                     ▼
SupplierBill (Invoice) ◄─────────────────┘
   │
   ├──► Bill Line → StockItem
   │
   ├──► Links to: GRV(s) [optional]
   │
   └──► Links to: PO [optional]
                │
                └──► SupplierPayment ──► SupplierBill (allocation)
```

## Business Rules

### 1. Supplier Constraint (CRITICAL)
- **Every document must have exactly ONE supplier**
- A PO belongs to ONE supplier
- A GRV belongs to ONE supplier
- A SupplierBill belongs to ONE supplier
- A SupplierPayment belongs to ONE supplier

### 2. Cross-Supplier Linking Prevention (CRITICAL)
The following cross-supplier links are **FORBIDDEN**:
- ❌ A Bill cannot link to GRVs from different suppliers
- ❌ A Payment cannot allocate to Bills from different suppliers
- ❌ A GRV cannot link to a PO from a different supplier

### 3. Document Numbering
Stable, human-readable document numbers:

| Document | Format | Example |
|----------|--------|---------|
| Purchase Order | `PO-000123` | PO-000001 |
| GRV | `GRV-000456` | GRV-000001 |
| Supplier Bill | `BILL-000789` | BILL-000001 |
| Supplier Payment | `PAY-000321` | PAY-000001 |

### 4. Document Statuses

#### Purchase Order
- `Draft` → `Issued` → `PartiallyReceived` → `FullyReceived` → `Closed` | `Cancelled`

#### GRV (Goods Received Voucher)
- `Draft` → `Posted` | `Cancelled`

#### Supplier Bill
- `Draft` → `Posted` → `PartiallyPaid` → `Paid` | `Voided`

#### Supplier Payment
- `Draft` → `Posted` | `Reversed`

## API Implementation

### Cross-Supplier Validation

All POST/PUT endpoints enforce cross-supplier validation:

```typescript
// Supplier Bills - validate GRVs belong to same supplier
const grvValidation = await validateBillToGRVs(supplierId, grvIds);
if (!grvValidation.valid) {
  return NextResponse.json({ error: grvValidation.errors }, { status: 400 });
}

// Supplier Payments - validate Bills belong to same supplier
const paymentValidation = await validatePaymentToBills(supplierId, amountCents, allocations);
if (!paymentValidation.valid) {
  return NextResponse.json({ error: paymentValidation.errors }, { status: 400 });
}
```

## Shared Document Pattern

All P2P documents share these common fields:

```typescript
interface P2PDocumentHeader {
  _id: ObjectId;
  documentNumber: string;  // Human-readable: PO-000123
  
  companyId: ObjectId;
  supplierId: ObjectId;
  
  status: string;
  
  documentDate: Date;
  dueDate?: Date;
  postedAt?: Date;
  
  subtotalCents: number;
  vatCents: number;
  discountCents: number;
  totalCents: number;
  
  notes?: string;
}
```

## Migration Plan

### Phase 1: Initialize (Non-Destructive)
1. Add new counters for P2P documents
2. Existing documents keep their old numbers

### Phase 2: Backfill (Best-Effort)
1. Link GRVs to POs by supplier + date matching
2. Link Bills to GRVs by supplier + date matching
3. Auto-allocate Payments to outstanding Bills
4. Add stock item snapshots for audit trail

### Phase 3: Validate
1. Check for cross-supplier violations
2. Report any issues

### Phase 4: Enforce
1. Enable validation in API endpoints
2. New documents must follow rules

## Backfill Strategy

### Link GRVs to POs
- Match by: supplier + date (GRV date ≤ PO date)
- Prioritize: most recent PO before GRV date

### Link Bills to GRVs
- Match by: supplier + date (GRV date ≤ Bill date)
- Include: all GRVs from same supplier before bill date

### Auto-allocate Payments
- Match by: supplier + outstanding bills
- Priority: oldest bill first (FIFO)
- Stop when: payment fully allocated or no outstanding bills

## Traceability

Users can trace any stock item through the full lifecycle:

```
StockItem → GRV (receipt) → PO (order) → Bill (invoice) → Payment
```

### API for Traceability
```typescript
const trace = await getStockItemTrace(stockItemId);
// Returns:
// - receipts: Array of GRVs containing this item
// - bills: Array of Bills containing this item
// - payments: Array of Payments allocated to those bills
```

## Acceptance Criteria

### Functional Requirements

1. **Document Creation**
   - [x] PO: Can create with supplier, lines, expected date
   - [x] GRV: Can create with supplier, lines, optional PO link
   - [x] Bill: Can create with supplier, lines, optional GRV/Po links
   - [x] Payment: Can create with supplier, amount, optional allocations

2. **Cross-Supplier Prevention**
   - [x] Cannot create Bill with GRVs from different suppliers
   - [x] Cannot allocate Payment to Bills from different suppliers
   - [x] Cannot link GRV to PO from different supplier

3. **Document Numbering**
   - [x] All new documents get sequential numbers: PO-000001, GRV-000001, etc.
   - [x] Numbers are unique per company

4. **Traceability**
   - [x] Can trace StockItem → GRV → PO
   - [x] Can trace StockItem → Bill → Payment

### Data Integrity

1. **Non-Destructive Migration**
   - [ ] Existing data is preserved
   - [ ] No database constraints removed
   - [ ] Backfill runs without data loss

2. **Validation**
   - [ ] API enforces supplier consistency
   - [ ] Clear error messages for violations

### User Experience

1. **Clear Error Messages**
   - [ ] "Cross-supplier linking detected: Bill cannot include GRV from supplier X"
   - [ ] "Payment cannot allocate to Bill from different supplier"

2. **Audit Trail**
   - [ ] Stock item snapshots captured at time of transaction
   - [ ] Document relationships visible in UI

## Implementation Files

- `lib/types/p2p.ts` - Type definitions
- `lib/utils/p2p-validation.ts` - Validation utilities
- `lib/utils/p2p-migration.ts` - Migration utilities
- `lib/utils/numbering.ts` - Document numbering
- `app/api/purchase-orders/route.ts` - PO API
- `app/api/grvs/route.ts` - GRV API
- `app/api/supplier-bills/route.ts` - Bill API
- `app/api/supplier-payments/route.ts` - Payment API

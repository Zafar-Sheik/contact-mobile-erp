import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const BillLineSchema = new Schema(
  {
    lineNo: { type: Number, required: true, min: 1 },
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", required: true, index: true },
    
    // Item snapshot for audit
    itemSnapshot: {
      sku: { type: String, required: true },
      name: { type: String, required: true },
      unit: { type: String, default: "each" },
      vatRate: { type: Number, default: 15 },
      isVatExempt: { type: Boolean, default: false },
    },
    
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    
    unitCostCents: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, default: 15, min: 0, max: 100 },
    
    // Line calculations
    vatCents: { type: Number, required: true, min: 0, default: 0 },
    subtotalCents: { type: Number, required: true, min: 0 },
    
    // Reference to source GRV
    grvId: { type: Schema.Types.ObjectId, ref: "GRV", required: true, index: true },
    
    // Optional reference to PO line
    poLineId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: true },
);

const SupplierBillSchema = new Schema(
  addBaseFields({
    // Bill number - unique identifier
    billNumber: { type: String, required: true, maxlength: 50, index: true },
    
    // Supplier reference - required
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    
    // Optional reference to Purchase Order this bill relates to
    poId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", default: null, index: true },
    
    // Array of GRVs included in this bill
    grvIds: { type: [{ type: Schema.Types.ObjectId, ref: "GRV" }], default: [], index: true },
    
    // Dates
    billDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, default: null, index: true },
    
    // Status
    status: {
      type: String,
      enum: ["Draft", "Posted", "PartiallyPaid", "Paid", "Voided"],
      default: "Draft",
      index: true,
    },
    
    // Supplier's invoice reference
    reference: { type: String, default: "", maxlength: 100 },
    
    // Financial totals
    subtotalCents: { type: Number, required: true, min: 0, default: 0 },
    vatCents: { type: Number, required: true, min: 0, default: 0 },
    discountCents: { type: Number, required: true, min: 0, default: 0 },
    totalCents: { type: Number, required: true, min: 0, default: 0 },
    
    // Payment tracking
    paidCents: { type: Number, required: true, min: 0, default: 0 },
    
    // Additional fields
    notes: { type: String, default: "", maxlength: 5000 },
    
    // Timestamps for status changes
    postedAt: { type: Date, default: null, index: true },
    voidedAt: { type: Date, default: null, index: true },
    
    // Posted/Voided by
    postedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    
    // Line items
    billLines: { type: [BillLineSchema], default: [] },
  }),
  baseOptions,
);

SupplierBillSchema.plugin(softDeletePlugin);

// Compound indexes
SupplierBillSchema.index({ companyId: 1, billNumber: 1 }, { unique: true });
SupplierBillSchema.index({ companyId: 1, supplierId: 1, status: 1 });
SupplierBillSchema.index({ companyId: 1, status: 1, billDate: -1 });
SupplierBillSchema.index({ companyId: 1, poId: 1, billDate: -1 });

export const SupplierBill =
  models.SupplierBill || model("SupplierBill", SupplierBillSchema);

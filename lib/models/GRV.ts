import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const GRVLineSchema = new Schema(
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

    orderedQty: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, required: true, min: 0 },

    unitCostCents: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ["none", "percent", "amount"], default: "none" },
    discountValue: { type: Number, default: 0, min: 0 },
    
    // Line calculations
    subtotalCents: { type: Number, required: true, min: 0 },
    vatAmountCents: { type: Number, default: 0, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },

    // Tracking fields
    batchNumber: { type: String, default: "" },
    expiryDate: { type: Date, default: null },
    serialNumbers: [{ type: String, default: [] }],

    // Variance handling
    varianceReason: { 
      type: String, 
      enum: ["none", "damaged", "short_delivery", "wrong_item", "free_stock", "other"], 
      default: "none" 
    },
    remarks: { type: String, default: "", maxlength: 1000 },
  },
  { _id: true },
);

const GRVSchema = new Schema(
  addBaseFields({
    grvNumber: { type: String, required: true, maxlength: 50, index: true },

    // Supplier reference
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    
    // Optional references
    poId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", default: null, index: true },
    supplierInvoiceId: { type: Schema.Types.ObjectId, ref: "SupplierInvoice", default: null },
    
    // Reference info
    referenceType: { type: String, enum: ["none", "po", "supplier_invoice", "delivery_note"], default: "none" },
    referenceNumber: { type: String, default: "", maxlength: 100 },

    // Location
    locationId: { type: String, default: "main", maxlength: 100 },
    locationName: { type: String, default: "Main Warehouse", maxlength: 200 },

    // Dates
    receivedAt: { type: Date, required: true, index: true },
    postedAt: { type: Date, default: null },

    // Status
    status: { type: String, enum: ["Draft", "Posted", "Cancelled"], default: "Draft", index: true },

    // Lines
    lines: { type: [GRVLineSchema], default: [] },

    // Totals
    subtotalCents: { type: Number, default: 0, min: 0 },
    vatTotalCents: { type: Number, default: 0, min: 0 },
    discountTotalCents: { type: Number, default: 0, min: 0 },
    grandTotalCents: { type: Number, default: 0, min: 0 },

    // Notes
    notes: { type: String, default: "", maxlength: 5000 },

    // Posted by
    postedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  }),
  baseOptions,
);

GRVSchema.plugin(softDeletePlugin);

// Compound indexes
GRVSchema.index({ companyId: 1, grvNumber: 1 }, { unique: true });
GRVSchema.index({ companyId: 1, supplierId: 1, receivedAt: -1 });
GRVSchema.index({ companyId: 1, status: 1, createdAt: -1 });
GRVSchema.index({ companyId: 1, poId: 1, receivedAt: -1 });

export const GRV = models.GRV || model("GRV", GRVSchema);

import { Schema, model, models, Document, Types } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

// ============================================================================
// INTERFACES
// ============================================================================

export interface IPOLine {
  lineNo: number;
  stockItemId: Types.ObjectId | null;
  skuSnapshot: string;
  nameSnapshot: string;
  descriptionSnapshot: string;
  unitSnapshot: string;
  description: string;
  quantity: number;
  orderedQty: number;
  receivedQty: number;
  unitCostCents: number;
  subtotalCents: number;
  taxRate: number | null;
  discountCents: number;
}

export interface IPurchaseOrder extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  poNumber: string;
  supplierId: Types.ObjectId;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CLOSED" | "CANCELLED";
  issuedAt: Date | null;
  expectedAt: Date | null;
  lines: IPOLine[];
  subtotalCents: number;
  taxCents: number;
  grandTotalCents: number;
  notes: string;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const POLineSchema = new Schema<IPOLine>(
  {
    lineNo: { type: Number, required: true, min: 1 },
    
    // Stock item reference (for modal selection)
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", default: null, index: true },
    
    // Snapshots copied at time of selection (for audit)
    skuSnapshot: { type: String, default: "" },
    nameSnapshot: { type: String, default: "" },
    descriptionSnapshot: { type: String, default: "" },
    unitSnapshot: { type: String, default: "" },
    
    // Legacy field for backward compatibility - old POs may only have description
    description: { type: String, default: "" },
    
    // Quantity
    quantity: { type: Number, required: true, min: 0, default: 0 },
    // Keep orderedQty for backward compatibility
    orderedQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    
    // Pricing - use cost price (supplier-facing document)
    unitCostCents: { type: Number, required: true, min: 0, default: 0 },
    subtotalCents: { type: Number, required: true, min: 0, default: 0 },
    
    // Optional tax and discount
    taxRate: { type: Number, default: null },
    discountCents: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  addBaseFields({
    poNumber: { type: String, required: true, maxlength: 50, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },

    issuedAt: { type: Date, default: null, index: true },
    expectedAt: { type: Date, default: null },

    lines: { type: [POLineSchema], default: [] },

    // Financial totals (server-calculated)
    subtotalCents: { type: Number, required: true, min: 0, default: 0 },
    taxCents: { type: Number, default: 0, min: 0 },
    grandTotalCents: { type: Number, required: true, min: 0, default: 0 },
    
    notes: { type: String, default: "", maxlength: 5000 },
  }),
  baseOptions,
);

PurchaseOrderSchema.plugin(softDeletePlugin);

PurchaseOrderSchema.index({ companyId: 1, poNumber: 1 }, { unique: true });

const PurchaseOrder = models.PurchaseOrder || model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);

export { PurchaseOrder, POLineSchema };

import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const POLineSchema = new Schema(
  {
    lineNo: { type: Number, required: true, min: 1 },
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },

    orderedQty: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, required: true, min: 0, default: 0 },

    unitCostCents: { type: Number, required: true, min: 0 },
    subtotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PurchaseOrderSchema = new Schema(
  addBaseFields({
    poNumber: { type: String, required: true, maxlength: 50, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },

    status: {
      type: String,
      enum: ["Draft", "Issued", "PartiallyReceived", "FullyReceived", "Closed", "Cancelled"],
      default: "Draft",
      index: true,
    },

    issuedAt: { type: Date, default: null, index: true },
    expectedAt: { type: Date, default: null },

    lines: { type: [POLineSchema], default: [] },

    subtotalCents: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: "", maxlength: 5000 },
  }),
  baseOptions,
);

PurchaseOrderSchema.plugin(softDeletePlugin);

PurchaseOrderSchema.index({ companyId: 1, poNumber: 1 }, { unique: true });

export const PurchaseOrder = models.PurchaseOrder || model("PurchaseOrder", PurchaseOrderSchema);
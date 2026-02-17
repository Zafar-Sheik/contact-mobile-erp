// lib/models/_lines.ts
import { Schema } from "mongoose";

export const MoneyCentsField = { type: Number, required: true, min: 0 };

export const SalesLineSchema = new Schema(
  {
    lineNo: { type: Number, required: true, min: 1 },

    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", default: null },
    description: { type: String, required: false, trim: true, maxlength: 500, default: "" },

    quantity: { type: Number, required: true, min: 0 },
    unitPriceCents: MoneyCentsField,

    discountCents: { type: Number, default: 0, min: 0 },
    subtotalCents: MoneyCentsField,

    vatRate: { type: Number, default: 15, min: 0, max: 100 },
    vatCents: MoneyCentsField,

    totalCents: MoneyCentsField,
  },
  { _id: false },
);
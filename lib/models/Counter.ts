import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions } from "./_base";

const CounterSchema = new Schema(
  addBaseFields({
    key: { type: String, required: true, trim: true, maxlength: 40 }, // e.g. "INV", "QTE", "PO", "GRV", "SPINV"
    nextNumber: { type: Number, required: true, min: 1, default: 1 },
    prefix: { type: String, default: "", maxlength: 10 }, // e.g. "INV-"
    padding: { type: Number, default: 5, min: 0, max: 12 }, // INV-00001
  }),
  baseOptions,
);

CounterSchema.index({ companyId: 1, key: 1 }, { unique: true });

export const Counter = models.Counter || model("Counter", CounterSchema);
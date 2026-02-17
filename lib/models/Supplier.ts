import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const SupplierSchema = new Schema(
  addBaseFields({
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },

    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      line2: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 120 },
      provinceState: { type: String, trim: true, maxlength: 120 },
      country: { type: String, trim: true, maxlength: 120, default: "South Africa" },
      postalCode: { type: String, trim: true, maxlength: 20 },
    },

    vatNumber: { type: String, trim: true, maxlength: 60 },
    paymentTermsDays: { type: Number, default: 0, min: 0 },

    // Don’t store bank account details in plaintext. Store an encrypted ref or vault key.
    bankRef: { type: String, default: null, maxlength: 120 },

    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: "", maxlength: 5000 },
  }),
  baseOptions,
);

SupplierSchema.plugin(softDeletePlugin);
SupplierSchema.index({ companyId: 1, name: 1 });

export const Supplier = models.Supplier || model("Supplier", SupplierSchema);
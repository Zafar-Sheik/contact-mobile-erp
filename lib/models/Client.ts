import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const ClientSchema = new Schema(
  addBaseFields({
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },

    billing: {
      address: {
        line1: { type: String, trim: true, maxlength: 200 },
        line2: { type: String, trim: true, maxlength: 200 },
        city: { type: String, trim: true, maxlength: 120 },
        provinceState: { type: String, trim: true, maxlength: 120 },
        country: { type: String, trim: true, maxlength: 120, default: "South Africa" },
        postalCode: { type: String, trim: true, maxlength: 20 },
      },
      vatNumber: { type: String, trim: true, maxlength: 60 },
      isVatRegistered: { type: Boolean, default: false },
    },

    credit: {
      creditLimitCents: { type: Number, default: 0, min: 0 },
      paymentTermsDays: { type: Number, default: 0, min: 0 },
    },

    notes: { type: String, default: "", maxlength: 5000 },
    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

ClientSchema.plugin(softDeletePlugin);

ClientSchema.index({ companyId: 1, name: 1 });

export const Client = models.Client || model("Client", ClientSchema);
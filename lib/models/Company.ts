import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const CompanyProfileSchema = new Schema(
  {
    legalName: { type: String, required: true, trim: true, maxlength: 200 },
    tradingName: { type: String, trim: true, maxlength: 200 },
    registrationNumber: { type: String, trim: true, maxlength: 60 },
    vatNumber: { type: String, trim: true, maxlength: 60 },
    isVatRegistered: { type: Boolean, default: false },

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

    branding: {
      logoUrl: { type: String, trim: true, maxlength: 500 },
      primaryColor: { type: String, trim: true, maxlength: 20 },
    },
  },
  { _id: false },
);

const CompanySchema = new Schema(
  addBaseFields({
    // companyId is included by baseFields, but for Company itself it’s redundant;
    // still okay to keep for uniformity or remove & special-case.
    // If you want, remove companyId from Company by overriding in your create logic.

    profile: { type: CompanyProfileSchema, required: true },
    status: { type: String, enum: ["Active", "Suspended"], default: "Active", index: true },

    // Optional secure storage reference for bank details (store encrypted elsewhere)
    bankRef: { type: String, default: null, maxlength: 120 },
  }),
  baseOptions,
);

CompanySchema.plugin(softDeletePlugin);

// You’ll usually enforce unique company legalName at app level (names can collide globally).
CompanySchema.index({ "profile.legalName": 1 });

export const Company = models.Company || model("Company", CompanySchema);
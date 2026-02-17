import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const SiteSchema = new Schema(
  addBaseFields({
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    code: { type: String, required: true, trim: true, maxlength: 20, index: true },
    
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      line2: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 120 },
      provinceState: { type: String, trim: true, maxlength: 120 },
      country: { type: String, trim: true, maxlength: 120, default: "South Africa" },
      postalCode: { type: String, trim: true, maxlength: 20 },
    },

    contactPerson: { type: String, trim: true, maxlength: 200 },
    contactPhone: { type: String, trim: true, maxlength: 50 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },

    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: "", maxlength: 5000 },
  }),
  baseOptions,
);

SiteSchema.plugin(softDeletePlugin);
SiteSchema.index({ companyId: 1, name: 1 });
SiteSchema.index({ companyId: 1, code: 1 }, { unique: true });

export const Site = models.Site || model("Site", SiteSchema);

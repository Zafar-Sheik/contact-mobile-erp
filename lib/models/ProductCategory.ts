import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const ProductCategorySchema = new Schema(
  addBaseFields({
    name: { type: String, required: true, trim: true, maxlength: 100, index: true },
    description: { type: String, default: "", maxlength: 500 },
    parentCategoryId: { type: Schema.Types.ObjectId, ref: "ProductCategory", default: null },
    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

ProductCategorySchema.plugin(softDeletePlugin);

// Index for hierarchical queries
ProductCategorySchema.index({ companyId: 1, parentCategoryId: 1 });

export const ProductCategory = models.ProductCategory || model("ProductCategory", ProductCategorySchema);

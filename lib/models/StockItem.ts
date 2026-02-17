import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const StockItemSchema = new Schema(
  addBaseFields({
    sku: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    description: { type: String, default: "", maxlength: 2000 },

    categoryId: { type: Schema.Types.ObjectId, ref: "ProductCategory", default: null },

    unit: { type: String, default: "each", trim: true, maxlength: 30 },

    pricing: {
      salePriceCents: { type: Number, default: 0, min: 0 },
      costPriceCents: { type: Number, default: 0, min: 0 }, // Last purchase cost
      averageCostCents: { type: Number, default: 0, min: 0 }, // Weighted average cost
      markupPercent: { type: Number, default: 0, min: 0 },
    },

    tax: {
      vatRate: { type: Number, default: 15, min: 0, max: 100 }, // SA default
      isVatExempt: { type: Boolean, default: false },
    },

    inventory: {
      onHand: { type: Number, default: 0, min: 0 }, // Current stock on hand
      available: { type: Number, default: 0, min: 0 }, // Available (onHand - allocated)
      reserved: { type: Number, default: 0, min: 0 }, // Allocated/reserved
      reorderLevel: { type: Number, default: 0, min: 0 },
      reorderQuantity: { type: Number, default: 0, min: 0 },
      location: { type: String, default: "main", maxlength: 100 },
      binNumber: { type: String, default: "", maxlength: 50 },
    },

    // Tracking options
    trackInventory: { type: Boolean, default: true, index: true },
    trackBatch: { type: Boolean, default: false }, // Batch tracking
    trackSerial: { type: Boolean, default: false }, // Serial tracking
    trackExpiry: { type: Boolean, default: false }, // Expiry tracking

    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", default: null, index: true },
    manufacturer: { type: String, default: "", trim: true, maxlength: 100 },
    brand: { type: String, default: "", trim: true, maxlength: 100 },
    partNumber: { type: String, default: "", trim: true, maxlength: 80 },
    barcode: { type: String, default: "", trim: true, maxlength: 50, index: true },

    dimensions: {
      length: { type: Number, default: 0, min: 0 },
      width: { type: Number, default: 0, min: 0 },
      height: { type: Number, default: 0, min: 0 },
      weight: { type: Number, default: 0, min: 0 },
      unit: { type: String, default: "cm" },
    },

    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

StockItemSchema.plugin(softDeletePlugin);

// Indexes
StockItemSchema.index({ companyId: 1, sku: 1 }, { unique: true });
StockItemSchema.index({ companyId: 1, categoryId: 1 });
StockItemSchema.index({ companyId: 1, "inventory.onHand": 1 });
StockItemSchema.index({ companyId: 1, "inventory.onHand": 1, "inventory.reorderLevel": 1 });
StockItemSchema.index({ companyId: 1, isActive: 1 });
StockItemSchema.index({ companyId: 1, barcode: 1 });

export const StockItem = models.StockItem || model("StockItem", StockItemSchema);

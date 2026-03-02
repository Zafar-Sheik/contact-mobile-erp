import { Schema, model, models, Document, Types } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

interface IStockItem extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  sku: string;
  name: string;
  description: string;
  unit: string;
  pricing: {
    salePriceCents: number;
    costPriceCents: number;
    averageCostCents: number;
    markupPercent: number;
  };
  tax: {
    vatRate: number;
    isVatExempt: boolean;
  };
  inventory: {
    onHand: number;
    available: number;
    reserved: number;
    reorderLevel: number;
    reorderQuantity: number;
    location: string;
    binNumber: string;
  };
  trackInventory: boolean;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  supplierId: Types.ObjectId | null;
  siteId: Types.ObjectId | null;
  manufacturer: string;
  brand: string;
  partNumber: string;
  barcode: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: string;
  };
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StockItemSchema = new Schema<IStockItem>(
  addBaseFields({
    sku: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    description: { type: String, default: "", maxlength: 2000 },

    unit: { type: String, default: "each", trim: true, maxlength: 30 },

    pricing: {
      salePriceCents: { type: Number, default: 0, min: 0 },
      costPriceCents: { type: Number, default: 0, min: 0 },
      averageCostCents: { type: Number, default: 0, min: 0 },
      markupPercent: { type: Number, default: 0, min: 0 },
    },

    tax: {
      vatRate: { type: Number, default: 15, min: 0, max: 100 },
      isVatExempt: { type: Boolean, default: false },
    },

    inventory: {
      onHand: { type: Number, default: 0, min: 0 },
      available: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 },
      reorderLevel: { type: Number, default: 0, min: 0 },
      reorderQuantity: { type: Number, default: 0, min: 0 },
      location: { type: String, default: "main", maxlength: 100 },
      binNumber: { type: String, default: "", maxlength: 50 },
    },

    trackInventory: { type: Boolean, default: true, index: true },
    trackBatch: { type: Boolean, default: false },
    trackSerial: { type: Boolean, default: false },
    trackExpiry: { type: Boolean, default: false },

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

// Indexes for efficient querying

// Unique constraint: SKU must be unique per company
StockItemSchema.index({ companyId: 1, sku: 1 }, { unique: true });

// Compound index for company-scoped name searches and sorting by name
StockItemSchema.index({ companyId: 1, name: 1 });

// Text index for full-text search across name, sku, description
// Supports efficient searching across 20k+ items without collection scans
StockItemSchema.index(
  { name: "text", sku: "text", description: "text" },
  { default_language: "english", weights: { name: 10, sku: 5, description: 1 } }
);

// Index for sorting by recently updated (for "recent items" feature)
StockItemSchema.index({ companyId: 1, updatedAt: -1 });

// Additional utility indexes
StockItemSchema.index({ companyId: 1, "inventory.onHand": 1 });
StockItemSchema.index({ companyId: 1, "inventory.onHand": 1, "inventory.reorderLevel": 1 });
StockItemSchema.index({ companyId: 1, isActive: 1 });
StockItemSchema.index({ companyId: 1, barcode: 1 });

// Compound index for text search with company filter (optimizes $text + companyId queries)
StockItemSchema.index({ companyId: 1, _id: 1 });

// Export the model - use existing if available (for hot reloading)
export const StockItem = 
  models.StockItem || model("StockItem", StockItemSchema);

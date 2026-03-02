import mongoose, { Schema, Document } from "mongoose";

export interface IStockItemUsage extends Document {
  companyId: mongoose.Types.ObjectId;
  stockItemId: mongoose.Types.ObjectId;
  lastUsedAt: Date;
}

const StockItemUsageSchema = new Schema<IStockItemUsage>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    stockItemId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "StockItem",
    },
    lastUsedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for efficient queries
StockItemUsageSchema.index(
  { companyId: 1, stockItemId: 1 },
  { unique: true }
);
StockItemUsageSchema.index({ companyId: 1, lastUsedAt: -1 });

export const StockItemUsage =
  mongoose.models.StockItemUsage ||
  mongoose.model<IStockItemUsage>("StockItemUsage", StockItemUsageSchema);

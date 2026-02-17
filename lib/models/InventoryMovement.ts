import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const InventoryMovementSchema = new Schema(
  addBaseFields({
    // Item reference
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", required: true, index: true },
    
    // Location
    locationId: { type: String, default: "main", maxlength: 100 },
    locationName: { type: String, default: "Main Warehouse", maxlength: 200 },

    // Source document
    sourceType: { 
      type: String, 
      enum: ["GRV", "SALE", "ADJUSTMENT", "TRANSFER", "RETURN", "CANCEL_GRV", "CANCEL_SALE"], 
      required: true, 
      index: true 
    },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    sourceLineId: { type: Schema.Types.ObjectId, default: null },

    // Movement details
    movementType: { type: String, enum: ["IN", "OUT"], required: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCostCents: { type: Number, default: 0, min: 0 },

    // Tracking fields
    batchNumber: { type: String, default: "" },
    expiryDate: { type: Date, default: null },
    serialNumbers: [{ type: String, default: [] }],

    // Running totals after this movement
    quantityBefore: { type: Number, default: 0, min: 0 },
    quantityAfter: { type: Number, default: 0, min: 0 },
    costBeforeCents: { type: Number, default: 0, min: 0 },
    costAfterCents: { type: Number, default: 0, min: 0 },
  }),
  baseOptions,
);

InventoryMovementSchema.plugin(softDeletePlugin);

// Compound indexes
InventoryMovementSchema.index({ companyId: 1, stockItemId: 1, createdAt: -1 });
InventoryMovementSchema.index({ companyId: 1, sourceType: 1, sourceId: 1 });
InventoryMovementSchema.index({ companyId: 1, locationId: 1, stockItemId: 1 });
InventoryMovementSchema.index({ companyId: 1, movementType: 1, createdAt: -1 });

export const InventoryMovement = models.InventoryMovement || model("InventoryMovement", InventoryMovementSchema);

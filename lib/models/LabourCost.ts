import { Schema, model, models, Document, Types } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

/**
 * LabourCost Model
 * 
 * Represents labour/services that can be sold to customers.
 * Similar to StockItem but for services instead of physical inventory.
 */
export interface ILabourCost extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  
  // Identification
  code: string;              // Unique code (e.g., LAB-001)
  name: string;              // e.g., "Installation", "Consultation"
  description: string;       // Detailed description
  
  // Unit of measurement
  unit: string;             // e.g., "hour", "day", "job", "each"
  
  // Pricing
  pricing: {
    rateCents: number;      // Selling rate to customer
    costCents: number;      // Internal cost
  };
  
  // Status
  isActive: boolean;
  
  // Audit
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const LabourCostSchema = new Schema<ILabourCost>(
  addBaseFields({
    // Identification
    code: { type: String, required: true, trim: true, maxlength: 50, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    description: { type: String, default: "", maxlength: 2000 },
    
    // Unit
    unit: { type: String, default: "hour", maxlength: 30 },
    
    // Pricing
    pricing: {
      rateCents: { type: Number, default: 0, min: 0 },
      costCents: { type: Number, default: 0, min: 0 },
    },
    
    // Status
    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

// Plugins
LabourCostSchema.plugin(softDeletePlugin);

// Indexes
LabourCostSchema.index({ companyId: 1, code: 1 }, { unique: true });
LabourCostSchema.index({ companyId: 1, name: 1 });
LabourCostSchema.index({ companyId: 1, isActive: 1 });

// Export
export const LabourCost = models.LabourCost || model<ILabourCost>("LabourCost", LabourCostSchema);

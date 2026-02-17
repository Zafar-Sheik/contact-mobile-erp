import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const VehicleSchema = new Schema(
  addBaseFields({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    registration: { type: String, required: true, trim: true, maxlength: 30, index: true },

    make: { type: String, default: "", trim: true, maxlength: 80 },
    model: { type: String, default: "", trim: true, maxlength: 80 },
    year: { type: Number },
    vin: { type: String, default: "", trim: true, maxlength: 50 },
    engineNumber: { type: String, default: "", trim: true, maxlength: 50 },
    color: { type: String, default: "", trim: true, maxlength: 30 },

    fuelType: { type: String, enum: ["Petrol", "Diesel", "Hybrid", "Electric"], default: "Diesel" },
    status: { type: String, enum: ["active", "maintenance", "inactive"], default: "active", index: true },

    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

VehicleSchema.plugin(softDeletePlugin);
VehicleSchema.index({ companyId: 1, registration: 1 }, { unique: true });

export const Vehicle = models.Vehicle || model("Vehicle", VehicleSchema);
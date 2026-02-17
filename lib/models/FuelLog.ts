import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const FuelLogSchema = new Schema(
  addBaseFields({
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    filledAt: { type: Date, required: true, index: true },

    odometerKm: { type: Number, required: true, min: 0 },
    liters: { type: Number, required: true, min: 0 },
    costCents: { type: Number, required: true, min: 0 },

    station: { type: String, default: "", trim: true, maxlength: 120 },
    notes: { type: String, default: "", maxlength: 2000 },
  }),
  baseOptions,
);

FuelLogSchema.plugin(softDeletePlugin);
FuelLogSchema.index({ companyId: 1, vehicleId: 1, filledAt: -1 });

export const FuelLog = models.FuelLog || model("FuelLog", FuelLogSchema);
import { Schema, model, models, Document, Types } from "mongoose";
import { addBaseFields, baseOptions } from "./_base";

interface ICounter extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  key: string;
  nextNumber: number;
  prefix: string;
  padding: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounter>(
  addBaseFields({
    key: { type: String, required: true, trim: true, maxlength: 40 },
    nextNumber: { type: Number, required: true, min: 1, default: 1 },
    prefix: { type: String, default: "", maxlength: 10 },
    padding: { type: Number, default: 5, min: 0, max: 12 },
  }),
  baseOptions,
);

CounterSchema.index({ companyId: 1, key: 1 }, { unique: true });

// Export the model - use existing if available (for hot reloading)
export const Counter = 
  models.Counter || model("Counter", CounterSchema);

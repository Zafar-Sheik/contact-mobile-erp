import { Schema, Types } from "mongoose";

export const baseOptions = {
  timestamps: true,
  minimize: false,
} as const;

export function addBaseFields(def: Record<string, any>) {
  return {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

    ...def,
  };
}

export type ObjectId = Types.ObjectId;

export const MoneyCents = {
  type: Number,
  required: true,
  min: 0,
} as const;

export const NullableMoneyCents = {
  type: Number,
  default: null,
  min: 0,
} as const;

export function softDeletePlugin(schema: Schema) {
  schema.index({ companyId: 1, isDeleted: 1 });

  schema.methods.softDelete = async function (userId: Types.ObjectId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.updatedBy = userId;
    await this.save();
  };
}
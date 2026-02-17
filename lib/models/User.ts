import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const UserSchema = new Schema(
  addBaseFields({
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },

    role: { type: String, enum: ["Owner", "Admin", "Manager", "Finance", "Warehouse", "Staff"], required: true, index: true },

    passHash: { type: String, required: true, select: false }, // never return by default
    isActive: { type: Boolean, default: true, index: true },

    permissions: [{ type: String, trim: true, maxlength: 80 }], // optional fine-grained
  }),
  baseOptions,
);

UserSchema.plugin(softDeletePlugin);

// unique per company
UserSchema.index({ companyId: 1, email: 1 }, { unique: true });

export const User = models.User || model("User", UserSchema);
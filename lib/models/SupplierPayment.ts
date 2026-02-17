import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const SupplierAllocationSchema = new Schema(
  {
    supplierInvoiceId: { type: Schema.Types.ObjectId, ref: "SupplierInvoice", index: true },
    supplierBillId: { type: Schema.Types.ObjectId, ref: "SupplierBill", index: true },
    amountCents: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

/**
 * SupplierPayment - Represents a payment made to a supplier
 * Can allocate to either SupplierInvoices or SupplierBills (or both)
 */
const SupplierPaymentSchema = new Schema(
  addBaseFields({
    paymentNumber: { type: String, required: true, maxlength: 50, index: true },

    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },

    paymentDate: { type: Date, required: true, index: true },
    method: { type: String, enum: ["Cash", "EFT", "Card", "Cheque", "Other"], required: true },

    reference: { type: String, default: "", trim: true, maxlength: 120 },
    amountCents: { type: Number, required: true, min: 1 },

    allocations: { type: [SupplierAllocationSchema], default: [] },
    unallocatedCents: { type: Number, required: true, min: 0, default: 0 },

    status: { type: String, enum: ["Posted", "Reversed"], default: "Posted", index: true },
    notes: { type: String, default: "", maxlength: 2000 },
  }),
  baseOptions,
);

SupplierPaymentSchema.plugin(softDeletePlugin);

SupplierPaymentSchema.index({ companyId: 1, paymentNumber: 1 }, { unique: true });
SupplierPaymentSchema.index({ companyId: 1, supplierId: 1, paymentDate: -1 });

export const SupplierPayment =
  models.SupplierPayment || model("SupplierPayment", SupplierPaymentSchema);
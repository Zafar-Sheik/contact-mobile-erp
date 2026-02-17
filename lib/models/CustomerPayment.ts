import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

/**
 * InvoiceAllocation - Tracks how a payment is allocated to invoices
 */
const InvoiceAllocationSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "SalesInvoice", required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    allocatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

/**
 * ClientSnapshot - Cached client information for the payment
 */
const ClientSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: "" },
  },
  { _id: false },
);

/**
 * CustomerPayment - Represents a payment received from a customer
 */
const CustomerPaymentSchema = new Schema(
  addBaseFields({
    // Payment number - unique identifier
    paymentNumber: { type: String, required: true, maxlength: 50, index: true },
    
    // Client reference
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    
    // Snapshot of client at time of payment
    clientSnapshot: { type: ClientSnapshotSchema, required: true },
    
    // Payment details
    amountCents: { type: Number, required: true, min: 1 },
    paymentDate: { type: Date, required: true, index: true },
    
    // Payment method
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "other"],
      required: true,
    },
    
    // Reference (bank reference, receipt number, etc.)
    reference: { type: String, default: "", trim: true, maxlength: 120 },
    
    // Invoice allocations
    allocatedInvoices: { type: [InvoiceAllocationSchema], default: [] },
    unallocatedCents: { type: Number, required: true, min: 0, default: 0 },
    
    // Status
    status: {
      type: String,
      enum: ["posted", "reversed"],
      default: "posted",
      index: true,
    },
    
    // Additional fields
    notes: { type: String, default: "", maxlength: 5000 },
    
    // Timestamps
    postedAt: { type: Date, default: null, index: true },
    reversedAt: { type: Date, default: null, index: true },
  }),
  baseOptions,
);

CustomerPaymentSchema.plugin(softDeletePlugin);

// Compound indexes
CustomerPaymentSchema.index({ companyId: 1, paymentNumber: 1 }, { unique: true });
CustomerPaymentSchema.index({ companyId: 1, clientId: 1, paymentDate: -1 });
CustomerPaymentSchema.index({ companyId: 1, status: 1, paymentDate: -1 });

export const CustomerPayment = models.CustomerPayment || model("CustomerPayment", CustomerPaymentSchema);

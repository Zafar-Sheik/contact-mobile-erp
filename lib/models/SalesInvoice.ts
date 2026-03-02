import { Schema, model, Document, Types } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

// Type definitions
interface SalesInvoiceLine {
  lineNo: number;
  stockItemId: Types.ObjectId | null;
  skuSnapshot: string;
  nameSnapshot: string;
  descriptionSnapshot: string;
  unitSnapshot: string;
  qty: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  lineTotalCents: number;
}

interface ClientSnapshot {
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    provinceState: string;
    country: string;
    postalCode: string;
  };
}

interface InvoiceTotals {
  subTotalCents: number;
  vatTotalCents: number;
  totalCents: number;
}

export interface ISalesInvoice extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdBy: Types.ObjectId | string;
  updatedBy: Types.ObjectId | string;
  invoiceNumber: string;
  clientId: Types.ObjectId;
  clientSnapshot: ClientSnapshot;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  lines: SalesInvoiceLine[];
  totals: InvoiceTotals;
  amountPaidCents: number;
  balanceDueCents: number;
  sourceQuoteId: Types.ObjectId | null;
  vatMode: "exclusive" | "inclusive" | "none";
  vatRateBps: number;
  issueDate: Date;
  dueDate: Date;
  notes: string;
  issuedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  overdueAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete: (userId: Types.ObjectId | string) => Promise<void>;
}

/**
 * SalesInvoiceLine - Line item for a sales invoice
 */
const SalesInvoiceLineSchema = new Schema(
  {
    lineNo: { type: Number, required: true, min: 1 },
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", default: null, index: true },
    
    // Snapshot of item at time of invoice (for audit)
    skuSnapshot: { type: String, default: "" },
    nameSnapshot: { type: String, default: "" },
    descriptionSnapshot: { type: String, default: "" },
    unitSnapshot: { type: String, default: "" },
    
    // Quantity and pricing
    qty: { type: Number, required: true, min: 0 },
    unitPriceCents: { type: Number, required: true, min: 0, default: 0 },
    discountCents: { type: Number, default: 0, min: 0 },
    
    // Tax
    taxable: { type: Boolean, default: true },
    lineTotalCents: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

/**
 * ClientSnapshot - Cached client information for the document
 */
const ClientSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      provinceState: { type: String, default: "" },
      country: { type: String, default: "South Africa" },
      postalCode: { type: String, default: "" },
    },
  },
  { _id: false },
);

/**
 * SalesInvoice - Sales invoice model
 */
const SalesInvoiceSchema = new Schema(
  addBaseFields({
    // Invoice number - unique identifier
    invoiceNumber: { type: String, required: true, maxlength: 50, index: true },
    
    // Client reference
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    
    // Snapshot of client at time of invoice
    clientSnapshot: { type: ClientSnapshotSchema, required: true },
    
    // Invoice status
    status: {
      type: String,
      enum: ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"],
      default: "draft",
      index: true,
    },
    
    // Line items
    lines: { type: [SalesInvoiceLineSchema], default: [] },
    
    // Financial totals
    totals: {
      subTotalCents: { type: Number, required: true, min: 0, default: 0 },
      vatTotalCents: { type: Number, required: true, min: 0, default: 0 },
      totalCents: { type: Number, required: true, min: 0, default: 0 },
    },
    
    // Payment tracking
    amountPaidCents: { type: Number, required: true, min: 0, default: 0 },
    balanceDueCents: { type: Number, required: true, min: 0, default: 0 },
    
    // Source quote (optional)
    sourceQuoteId: { type: Schema.Types.ObjectId, ref: "SalesQuote", default: null, index: true },
    
    // VAT configuration
    vatMode: {
      type: String,
      enum: ["exclusive", "inclusive", "none"],
      default: "exclusive",
    },
    vatRateBps: { type: Number, default: 1500, min: 0 }, // Basis points (1500 = 15%)
    
    // Dates
    issueDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    
    // Additional fields
    notes: { type: String, default: "", maxlength: 5000 },
    
    // Timestamps for status changes
    issuedAt: { type: Date, default: null, index: true },
    paidAt: { type: Date, default: null, index: true },
    cancelledAt: { type: Date, default: null, index: true },
    overdueAt: { type: Date, default: null, index: true },
  }),
  baseOptions,
);

SalesInvoiceSchema.plugin(softDeletePlugin);

// Compound indexes
SalesInvoiceSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
SalesInvoiceSchema.index({ companyId: 1, clientId: 1, status: 1 });
SalesInvoiceSchema.index({ companyId: 1, status: 1, issueDate: -1 });
SalesInvoiceSchema.index({ companyId: 1, dueDate: 1, status: 1 });

const SalesInvoice = model<ISalesInvoice>("SalesInvoice", SalesInvoiceSchema);

export { SalesInvoice, SalesInvoiceSchema };

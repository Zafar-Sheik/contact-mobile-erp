import { Schema, model, Document, Types } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

// Type definitions
interface SalesQuoteLine {
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

interface QuoteTotals {
  subTotalCents: number;
  vatTotalCents: number;
  totalCents: number;
}

export interface ISalesQuote extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  createdBy: Types.ObjectId | string;
  updatedBy: Types.ObjectId | string;
  quoteNumber: string;
  clientId: Types.ObjectId;
  clientSnapshot: ClientSnapshot;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  lines: SalesQuoteLine[];
  totals: QuoteTotals;
  vatMode: "exclusive" | "inclusive" | "none";
  vatRateBps: number;
  validUntil: Date | null;
  notes: string;
  sentAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  expiredAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  softDelete: (userId: Types.ObjectId | string) => Promise<void>;
}

/**
 * SalesQuoteLine - Line item for a sales quote
 */
const SalesQuoteLineSchema = new Schema(
  {
    lineNo: { type: Number, required: true, min: 1 },
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", default: null, index: true },
    
    // Snapshot of item at time of quote (for audit)
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
 * SalesQuote - Sales quotation model
 */
const SalesQuoteSchema = new Schema(
  addBaseFields({
    // Quote number - unique identifier
    quoteNumber: { type: String, required: true, maxlength: 50, index: true },
    
    // Client reference
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    
    // Snapshot of client at time of quote
    clientSnapshot: { type: ClientSnapshotSchema, required: true },
    
    // Quote status
    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "rejected", "expired"],
      default: "draft",
      index: true,
    },
    
    // Line items
    lines: { type: [SalesQuoteLineSchema], default: [] },
    
    // Financial totals
    totals: {
      subTotalCents: { type: Number, required: true, min: 0, default: 0 },
      vatTotalCents: { type: Number, required: true, min: 0, default: 0 },
      totalCents: { type: Number, required: true, min: 0, default: 0 },
    },
    
    // VAT configuration
    vatMode: {
      type: String,
      enum: ["exclusive", "inclusive", "none"],
      default: "exclusive",
    },
    vatRateBps: { type: Number, default: 1500, min: 0 }, // Basis points (1500 = 15%)
    
    // Validity
    validUntil: { type: Date, default: null },
    
    // Additional fields
    notes: { type: String, default: "", maxlength: 5000 },
    
    // Timestamps for status changes
    sentAt: { type: Date, default: null, index: true },
    acceptedAt: { type: Date, default: null, index: true },
    rejectedAt: { type: Date, default: null, index: true },
    expiredAt: { type: Date, default: null, index: true },
  }),
  baseOptions,
);

SalesQuoteSchema.plugin(softDeletePlugin);

// Compound indexes
SalesQuoteSchema.index({ companyId: 1, quoteNumber: 1 }, { unique: true });
SalesQuoteSchema.index({ companyId: 1, clientId: 1, status: 1 });
SalesQuoteSchema.index({ companyId: 1, status: 1, createdAt: -1 });

const SalesQuote = model<ISalesQuote>("SalesQuote", SalesQuoteSchema);

export { SalesQuote, SalesQuoteSchema };

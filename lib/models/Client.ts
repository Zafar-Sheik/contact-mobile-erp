import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

// Email address sub-schema
const EmailSchema = new Schema({
  address: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
  type: { type: String, enum: ['primary', 'billing', 'accounting', 'support', 'other'], default: 'primary' },
  label: { type: String, trim: true, maxlength: 50, default: '' }, // Custom label for 'other' type
  isPrimary: { type: Boolean, default: false },
}, { _id: false });

const ClientSchema = new Schema(
  addBaseFields({
    clientCode: { type: String, required: true, maxlength: 10 },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    emails: { type: [EmailSchema], default: [], validate: {
      validator: function(emails: any[]) {
        // Ensure at most one primary email
        const primaryCount = emails.filter(e => e.isPrimary).length;
        return primaryCount <= 1;
      },
      message: 'Only one email can be marked as primary'
    }},
    // Keep legacy email field for backward compatibility (computed from primary email)
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 50 },

    billing: {
      address: {
        line1: { type: String, trim: true, maxlength: 200 },
        line2: { type: String, trim: true, maxlength: 200 },
        city: { type: String, trim: true, maxlength: 120 },
        provinceState: { type: String, trim: true, maxlength: 120 },
        country: { type: String, trim: true, maxlength: 120, default: "South Africa" },
        postalCode: { type: String, trim: true, maxlength: 20 },
      },
      vatNumber: { type: String, trim: true, maxlength: 60 },
      isVatRegistered: { type: Boolean, default: false },
    },

    credit: {
      creditLimitCents: { type: Number, default: 0, min: 0 },
      paymentTermsDays: { type: Number, default: 0, min: 0 },
    },

    notes: { type: String, default: "", maxlength: 5000 },
    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

ClientSchema.plugin(softDeletePlugin);

// Pre-save middleware to sync legacy email field
ClientSchema.pre('save', function(next: any) {
  // Find primary email
  const primaryEmail = (this as any).emails?.find((email: any) => email.isPrimary);
  if (primaryEmail) {
    (this as any).email = primaryEmail.address;
  } else if ((this as any).emails?.length > 0) {
    // If no primary set, use first email as primary
    (this as any).emails[0].isPrimary = true;
    (this as any).email = (this as any).emails[0].address;
  } else {
    (this as any).email = '';
  }
  next();
});

ClientSchema.index({ companyId: 1, name: 1 });
ClientSchema.index({ companyId: 1, clientCode: 1 }, { unique: true });
ClientSchema.index({ companyId: 1, 'emails.address': 1 });

/**
 * Generate the next client code for a company
 * Format: C001, C002, C003, etc.
 */
export async function generateClientCode(companyId: string): Promise<string> {
  const { Client } = await import("./Client");
  
  // Find the highest client code for this company (sorted alphabetically descending)
  const highestClient = await Client.findOne({
    companyId,
    clientCode: { $exists: true, $nin: [null, ""] },
  })
    .sort({ clientCode: -1 })
    .select("clientCode")
    .lean();
  
  console.log("[Client] Highest client code found:", highestClient?.clientCode);
  
  let nextNum = 1;
  
  if (highestClient?.clientCode) {
    // Extract numeric portion from format like "C001" or "C027"
    const match = highestClient.clientCode.match(/^C(\d+)$/);
    console.log("[Client] Regex match:", match);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
      console.log("[Client] Next number will be:", nextNum);
    }
  }
  
  return `C${nextNum.toString().padStart(3, "0")}`;
}

export const Client = 
  models.Client || model("Client", ClientSchema);

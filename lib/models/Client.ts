import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const ClientSchema = new Schema(
  addBaseFields({
    clientCode: { type: String, required: true, maxlength: 10 },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
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

    // Opening/running balance - what the client owes the company (in cents)
    // Positive = client owes money, Negative = company owes client (overpayment/credit)
    balanceCents: { type: Number, default: 0 },

    // Unallocated payment funds available for future invoice allocations (in cents)
    unallocatedCents: { type: Number, default: 0, min: 0 },

    notes: { type: String, default: "", maxlength: 5000 },
    isActive: { type: Boolean, default: true, index: true },
  }),
  baseOptions,
);

ClientSchema.plugin(softDeletePlugin);

ClientSchema.index({ companyId: 1, name: 1 });
ClientSchema.index({ companyId: 1, clientCode: 1 }, { unique: true });

// Instance methods
ClientSchema.methods.calculateBalance = async function() {
  const SalesInvoice = (await import("./SalesInvoice")).SalesInvoice;
  const CustomerPayment = (await import("./CustomerPayment")).CustomerPayment;

  // Sum all invoice totals (excluding cancelled)
  const invoices = await SalesInvoice.find({
    clientId: this._id,
    isDeleted: false,
    status: { $ne: "cancelled" },
  }).select("totals.totalCents amountPaidCents balanceDueCents").lean();

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totals?.totalCents || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaidCents || 0), 0);

  // Calculate outstanding balance (what client owes)
  const balanceCents = totalInvoiced - totalPaid;

  // Get unallocated payments
  const payments = await CustomerPayment.find({
    clientId: this._id,
    isDeleted: false,
    status: "posted",
  }).select("unallocatedCents").lean();

  const unallocatedCents = payments.reduce((sum, pay) => sum + (pay.unallocatedCents || 0), 0);

  // Update the client record
  this.balanceCents = balanceCents;
  this.unallocatedCents = unallocatedCents;

  return {
    balanceCents,
    unallocatedCents,
    totalInvoiced,
    totalPaid,
  };
};

ClientSchema.methods.getBalanceSummary = async function() {
  const balance = await this.calculateBalance();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
  const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

  const SalesInvoice = (await import("./SalesInvoice")).SalesInvoice;

  // Get aging breakdown
  const invoices = await SalesInvoice.find({
    clientId: this._id,
    isDeleted: false,
    status: { $in: ["issued", "partially_paid", "paid"] },
  }).select("balanceDueCents dueDate issueDate").lean();

  let currentAmount = 0;
  let days31To60 = 0;
  let days61To90 = 0;
  let days91Plus = 0;

  for (const invoice of invoices) {
    const outstanding = invoice.balanceDueCents || 0;
    if (outstanding <= 0) continue;

    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(invoice.issueDate || now);

    if (dueDate >= thirtyDaysAgo) {
      currentAmount += outstanding;
    } else if (dueDate >= sixtyDaysAgo) {
      days31To60 += outstanding;
    } else if (dueDate >= ninetyDaysAgo) {
      days61To90 += outstanding;
    } else {
      days91Plus += outstanding;
    }
  }

  return {
    ...balance,
    currentAmount,
    days31To60,
    days61To90,
    days91Plus,
    totalOwing: Math.max(0, balance.balanceCents), // Positive balance = client owes
    availableCredit: Math.max(0, -balance.balanceCents), // Negative balance = company owes
  };
};

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

import { Client } from "../models/Client";
import { SalesInvoice } from "../models/SalesInvoice";

/**
 * Recalculate and update a client's balance based on outstanding invoices
 * @param clientId - The client's ID
 * @param companyId - The company ID for security
 * @returns The updated client document
 */
export async function recalculateClientBalance(clientId: string, companyId: string) {
  // Get all outstanding invoices for this client
  const outstandingInvoices = await SalesInvoice.find({
    clientId,
    companyId,
    isDeleted: false,
    status: { $in: ["issued", "partially_paid", "overdue"] }
  })
    .select("balanceDueCents")
    .lean();

  // Calculate actual balance from outstanding invoices
  const calculatedBalanceCents = outstandingInvoices.reduce(
    (sum, invoice) => sum + (invoice.balanceDueCents || 0),
    0
  );

  // Update the client's balance
  const updatedClient = await Client.findOneAndUpdate(
    { _id: clientId, companyId, isDeleted: false },
    { balanceCents: calculatedBalanceCents },
    { new: true }
  );

  return updatedClient;
}

/**
 * Recalculate balances for all clients in a company
 * @param companyId - The company ID
 * @returns Number of clients updated
 */
export async function recalculateAllClientBalances(companyId: string) {
  const clients = await Client.find({ companyId, isDeleted: false })
    .select("_id")
    .lean();

  let updatedCount = 0;

  for (const client of clients) {
    await recalculateClientBalance(client._id.toString(), companyId);
    updatedCount++;
  }

  return updatedCount;
}
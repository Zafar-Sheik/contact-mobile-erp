import mongoose from "mongoose";
import { Client } from "../models/Client";

/**
 * Validate that a client can receive a payment
 * Checks if the client exists and if the payment amount is valid
 * @param clientId - The client's ID
 * @param amountCents - The payment amount in cents
 * @returns Validation result with errors if any
 */
export async function validateClientForPayment(
  clientId: string | mongoose.Types.ObjectId,
  amountCents: number
) {
  const errors: string[] = [];

  // Validate amount
  if (!amountCents || amountCents <= 0) {
    errors.push("Payment amount must be greater than zero");
  }

  // Check if client exists
  const client = await Client.findOne({
    _id: clientId,
    isDeleted: false,
  }).lean();

  if (!client) {
    errors.push("Client not found or is deleted");
    return { valid: false, errors };
  }

  // Note: We allow overpayments (negative balance) so no validation on balanceCents
  // A client can have a negative balance (credit) or positive balance (amount owed)

  return {
    valid: errors.length === 0,
    errors,
  };
}
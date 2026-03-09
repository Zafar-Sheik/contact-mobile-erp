/**
 * Backfill customer codes for existing customers
 * 
 * This script:
 * - Finds all customers without customerCode
 * - Orders them by createdAt
 * - Assigns codes sequentially starting from C001
 * - Updates each record
 * 
 * Requirements:
 * - Codes remain unique per company
 * - Script is safe to run once
 * - Logs all updates
 * 
 * Usage:
 *   npx tsx scripts/backfill-customer-codes.ts
 * 
 * Or with ts-node:
 *   npx ts-node scripts/backfill-customer-codes.ts
 */

import { dbConnect } from "../lib/db";
import { Client } from "../lib/models/Client";

interface ClientDocument {
  _id: string;
  companyId: string;
  clientCode?: string;
  createdAt: Date;
}

async function backfillCustomerCodes() {
  console.log("Starting customer code backfill...\n");
  
  console.log("Connecting to database...");
  await dbConnect();
  console.log("Connected to database\n");

  // Find all clients without clientCode, ordered by createdAt
  console.log("Finding customers without customerCode...");
  
  const customersToUpdate = await Client.find({
    $or: [
      { clientCode: { $exists: false } },
      { clientCode: null },
      { clientCode: "" },
    ],
    isDeleted: false,
  } as any)
    .sort({ createdAt: 1 })
    .lean() as ClientDocument[];

  if (customersToUpdate.length === 0) {
    console.log("All customers already have codes! No updates needed.\n");
    return;
  }

  console.log(`Found ${customersToUpdate.length} customers without codes\n`);

  // Group customers by company
  const customersByCompany = new Map<string, ClientDocument[]>();
  for (const customer of customersToUpdate) {
    const existing = customersByCompany.get(customer.companyId) || [];
    existing.push(customer);
    customersByCompany.set(customer.companyId, existing);
  }

  let totalUpdated = 0;

  // Process each company
  for (const [companyId, customers] of customersByCompany) {
    console.log(`\nProcessing company: ${companyId}`);
    console.log(`Customers to update: ${customers.length}`);

    // Find the highest existing clientCode for this company
    const highestCustomer = await Client.findOne({
      companyId,
      isDeleted: false,
      clientCode: { $exists: true, $ne: "" },
    } as any)
      .sort({ clientCode: -1 })
      .select("clientCode")
      .lean() as { clientCode: string } | null;

    let nextNum = 1;
    if (highestCustomer?.clientCode) {
      const match = highestCustomer.clientCode.match(/^C(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
        console.log(`Highest existing code: ${highestCustomer.clientCode}`);
      }
    }

    console.log(`Starting code: C${nextNum.toString().padStart(3, "0")}\n`);

    // Update each customer with sequential codes
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const customerCode = `C${nextNum.toString().padStart(3, "0")}`;

      await Client.updateOne(
        { _id: customer._id },
        { $set: { clientCode: customerCode } }
      );

      const createdDate = customer.createdAt 
        ? new Date(customer.createdAt).toISOString().split("T")[0]
        : "unknown";

      console.log(
        `[${i + 1}/${customers.length}] ` +
        `Customer ${customer._id} (created: ${createdDate}) ` +
        `-> ${customerCode}`
      );

      nextNum++;
      totalUpdated++;
    }

    console.log(`\nUpdated ${customers.length} customers for company ${companyId}`);
  }

  console.log("\n==================================================");
  console.log(`Backfill complete! Updated ${totalUpdated} customers.`);
  console.log("==================================================");
}

backfillCustomerCodes().catch((error) => {
  console.error("\nError during backfill:", error);
  process.exit(1);
});

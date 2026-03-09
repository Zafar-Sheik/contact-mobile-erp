/**
 * Migration script to add clientCode to existing clients
 * Run this script once to populate existing clients with client codes
 * 
 * Usage: npx tsx app/api/clients/migrate-client-codes.ts
 */

import { dbConnect } from "@/lib/db";
import { Client } from "@/lib/models/Client";

interface ClientDocument {
  _id: string;
  companyId: string;
  clientCode?: string;
}

async function migrateClientCodes() {
  console.log("Connecting to database...");
  await dbConnect();

  console.log("Finding all clients without clientCode...");

  // Find all clients that don't have a clientCode
  const clientsWithoutCode = await Client.find({
    $or: [
      { clientCode: { $exists: false } },
      { clientCode: null },
      { clientCode: "" },
    ],
    isDeleted: false,
  } as any).lean() as ClientDocument[];

  console.log(`Found ${clientsWithoutCode.length} clients without clientCode`);

  if (clientsWithoutCode.length === 0) {
    console.log("No clients need migration.");
    return;
  }

  // Group clients by companyId
  const clientsByCompany = new Map<string, ClientDocument[]>();
  for (const client of clientsWithoutCode) {
    const existing = clientsByCompany.get(client.companyId) || [];
    existing.push(client);
    clientsByCompany.set(client.companyId, existing);
  }

  // Process each company's clients
  for (const [companyId, clients] of clientsByCompany) {
    console.log(`\nProcessing company ${companyId} with ${clients.length} clients...`);

    // Find the highest existing clientCode for this company
    const highestClient = await Client.findOne({
      companyId,
      isDeleted: false,
      clientCode: { $exists: true, $ne: "" },
    } as any)
      .sort({ clientCode: -1 })
      .select("clientCode")
      .lean() as { clientCode: string } | null;

    let nextNum = 1;
    if (highestClient?.clientCode) {
      const match = highestClient.clientCode.match(/^C(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    // Update each client with a unique code
    for (const client of clients) {
      const clientCode = `C${nextNum.toString().padStart(3, "0")}`;
      
      await Client.updateOne(
        { _id: client._id },
        { $set: { clientCode } }
      );

      console.log(`  Updated client ${client._id} -> ${clientCode}`);
      nextNum++;
    }
  }

  console.log("\n✅ Migration complete!");
}

migrateClientCodes().catch(console.error);

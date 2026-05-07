import { dbConnect } from "@/lib/db";
import { recalculateAllClientBalances } from "@/lib/utils/client-balance";

/**
 * Script to recalculate all client balances based on actual outstanding invoices
 * Run this to fix any discrepancies between stored balanceCents and actual invoice totals
 */
async function main() {
  console.log("Connecting to database...");
  await dbConnect();

  // For now, we'll assume a company ID. In production, this should be run for each company
  // or accept company ID as parameter
  const companyId = process.argv[2]; // Pass company ID as command line argument

  if (!companyId) {
    console.error("Please provide a company ID as a command line argument");
    console.error("Usage: npx tsx scripts/recalculate-client-balances.ts <companyId>");
    process.exit(1);
  }

  console.log(`Recalculating balances for company ${companyId}...`);

  try {
    const updatedCount = await recalculateAllClientBalances(companyId);
    console.log(`Successfully recalculated balances for ${updatedCount} clients`);
  } catch (error) {
    console.error("Error recalculating client balances:", error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
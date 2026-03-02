/**
 * MongoDB Index Verification Script for Stock Items
 *
 * This script verifies that indexes are properly set up and being used
 * for common queries. Run with: npx ts-node scripts/verify-stock-item-indexes.ts
 */

import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";

async function verifyIndexes() {
  console.log("🔍 Stock Item Index Verification\n");
  console.log("=" .repeat(60));

  await dbConnect();
  const collection = StockItem.collection;

  // 1. List all existing indexes
  console.log("\n📋 Current Indexes:");
  console.log("-".repeat(60));
  const indexes = await collection.indexes();
  indexes.forEach((idx) => {
    const fields = Object.entries(idx.key)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    console.log(`  • ${idx.name}`);
    console.log(`    Fields: { ${fields} }`);
    if (idx.unique) console.log(`    Unique: true`);
    if (idx.weights) console.log(`    Weights: ${JSON.stringify(idx.weights)}`);
    console.log();
  });

  // 2. Verify required indexes exist
  console.log("\n✅ Required Index Check:");
  console.log("-".repeat(60));

  const requiredIndexes = [
    { name: "companyId_1_name_1", fields: { companyId: 1, name: 1 } },
    { name: "companyId_1_updatedAt_-1", fields: { companyId: 1, updatedAt: -1 } },
    { name: "companyId_1_sku_1", fields: { companyId: 1, sku: 1 } },
  ];

  for (const required of requiredIndexes) {
    const exists = indexes.some((idx) => idx.name === required.name);
    console.log(`  ${exists ? "✅" : "❌"} ${required.name}`);
  }

  // Check for text index
  const hasTextIndex = indexes.some((idx) =>
    Object.values(idx.key).some((v) => v === "text")
  );
  console.log(`  ${hasTextIndex ? "✅" : "❌"} Text index on name/sku/description`);

  // 3. Test query performance with explain()
  console.log("\n⚡ Query Performance Analysis (explain):");
  console.log("-".repeat(60));

  // Test 1: Company + Name sort query
  console.log("\n  Test 1: Company-scoped name sort");
  const explain1 = await StockItem.find({
    companyId: "test-company-id",
    isDeleted: false,
  })
    .sort({ name: 1 })
    .limit(100)
    .explain("executionStats") as any;

  const stage1 = explain1.queryPlanner?.winningPlan;
  if (stage1) {
    console.log(`    Stage: ${stage1.stage}`);
    if (stage1.inputStage) {
      console.log(`    Input Stage: ${stage1.inputStage.stage}`);
    }
    console.log(`    Index Used: ${stage1.indexName || "NONE (Collection Scan!)"}`);
  }

  // Test 2: Text search
  console.log("\n  Test 2: Full-text search");
  try {
    const explain2 = await StockItem.find({
      $text: { $search: "test query" },
      companyId: "test-company-id",
    })
      .explain("executionStats") as any;

    const stage2 = explain2.queryPlanner?.winningPlan;
    if (stage2) {
      console.log(`    Stage: ${stage2.stage}`);
      console.log(`    Index Used: ${stage2.indexName || "NONE (Collection Scan!)"}`);
    }
  } catch (e) {
    console.log(`    Skipped (no test data)`);
  }

  // Test 3: UpdatedAt sort (recent items)
  console.log("\n  Test 3: Recent items by updatedAt");
  const explain3 = await StockItem.find({
    companyId: "test-company-id",
  })
    .sort({ updatedAt: -1 })
    .limit(100)
    .explain("executionStats") as any;

  const stage3 = explain3.queryPlanner?.winningPlan;
  if (stage3) {
    console.log(`    Stage: ${stage3.stage}`);
    console.log(`    Index Used: ${stage3.indexName || "NONE (Collection Scan!)"}`);
  }

  // 4. Index recommendations
  console.log("\n📊 Index Coverage Summary:");
  console.log("-".repeat(60));

  const hasCompanyNameIndex = indexes.some((idx) => idx.name === "companyId_1_name_1");
  const hasCompanyUpdatedIndex = indexes.some(
    (idx) => idx.name === "companyId_1_updatedAt_-1"
  );

  if (hasCompanyNameIndex && hasTextIndex && hasCompanyUpdatedIndex) {
    console.log("  ✅ All required indexes are present!");
    console.log("  ✅ Queries should be optimized for 20k+ items");
  } else {
    console.log("  ⚠️  Some indexes are missing. Run the app to auto-create them:");
    if (!hasCompanyNameIndex) console.log("     - Missing: { companyId: 1, name: 1 }");
    if (!hasTextIndex) console.log("     - Missing: text index on name/sku/description");
    if (!hasCompanyUpdatedIndex) console.log("     - Missing: { companyId: 1, updatedAt: -1 }");
  }

  console.log("\n" + "=".repeat(60));
  console.log("Index verification complete!\n");

  process.exit(0);
}

verifyIndexes().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

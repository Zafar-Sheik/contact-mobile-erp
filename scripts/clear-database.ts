/**
 * Database Clear Script
 * 
 * This script drops all collections from the database to provide a fresh start.
 * Use with caution - this will delete ALL data!
 * 
 * Run with: npx ts-node scripts/clear-database.ts
 * Or: npx tsx scripts/clear-database.ts
 */

import mongoose from 'mongoose';

// MongoDB connection string from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zafar:llQVnrdUMlOArymn@cluster0.xlqqbxl.mongodb.net/?appName=Cluster0';

// Collection names to clear (in order of dependencies)
const COLLECTIONS = [
  'sessions',
  'supplierpayments',
  'supplierbills',
  'purchaseorders',
  'grvinventoryitems',
  'grvs',
  'inventorymovements',
  'salesinvoices',
  'salesquotes',
  'stockitems',
  'productcategories',
  'vehicles',
  'fuellogs',
  'workflowtasks',
  'clients',
  'suppliers',
  'sites',
  'companies',
  'users',
  'counters',
];

async function clearDatabase() {
  console.log('🗑️  Database Clear Script');
  console.log('========================\n');

  if (!MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Failed to get database connection');
    }

    // Get list of existing collections
    const collections = await db.listCollections().toArray();
    const existingCollectionNames = collections.map(c => c.name);

    console.log(`Found ${existingCollectionNames.length} collections in the database.\n`);

    // Drop each collection
    let droppedCount = 0;
    let skippedCount = 0;

    for (const collectionName of COLLECTIONS) {
      if (existingCollectionNames.includes(collectionName)) {
        try {
          await db.dropCollection(collectionName);
          console.log(`   ✅ Dropped: ${collectionName}`);
          droppedCount++;
        } catch (error: any) {
          if (error.codeName === 'NamespaceNotFound') {
            console.log(`   ⚠️  Already removed: ${collectionName}`);
          } else {
            console.log(`   ❌ Error dropping ${collectionName}: ${error.message}`);
          }
        }
      } else {
        console.log(`   ⏭️  Skipped (not found): ${collectionName}`);
        skippedCount++;
      }
    }

    // Check for any additional collections not in our list
    const processedCollections = new Set(COLLECTIONS);
    const extraCollections = existingCollectionNames.filter(
      c => !processedCollections.has(c)
    );

    if (extraCollections.length > 0) {
      console.log('\n⚠️  Additional collections found (not in standard list):');
      for (const name of extraCollections) {
        console.log(`   - ${name}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Dropped: ${droppedCount} collections`);
    console.log(`   Skipped: ${skippedCount} collections`);
    console.log(`   Extra: ${extraCollections.length} collections`);

    console.log('\n✅ Database cleared successfully!');

  } catch (error) {
    console.error('\n❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run the script
clearDatabase();

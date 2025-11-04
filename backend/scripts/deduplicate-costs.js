// Script to clean up duplicate cost records and migrate to new ID format
// This script should be run once before deploying the deduplication changes

const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore
const firestore = new Firestore({
  projectId: 'billing-manager-gf',
  keyFilename: '/Users/gianlucaformica/Projects/billing-manager/gcp-service-account-key.json'
});

async function deduplicateCosts() {
  console.log('Starting cost deduplication process...\n');

  try {
    // Get all cost records
    const snapshot = await firestore.collection('costs').get();
    console.log(`Found ${snapshot.size} total cost records\n`);

    // Group by serviceId + date
    const recordsByKey = new Map();

    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp.split('T')[0];
      const key = `${data.serviceId}_${date}`;

      if (!recordsByKey.has(key)) {
        recordsByKey.set(key, []);
      }

      recordsByKey.get(key).push({
        id: doc.id,
        data: data,
        timestamp: data.timestamp
      });
    });

    // Find duplicates and records to migrate
    let duplicateCount = 0;
    let recordsToDelete = [];
    let recordsToMigrate = [];

    recordsByKey.forEach((records, key) => {
      if (records.length > 1) {
        // Sort by timestamp (newest first)
        records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        console.log(`⚠️  Duplicate: ${key} has ${records.length} records`);

        // Keep the newest, delete the rest
        const keepRecord = records[0];
        const deleteRecords = records.slice(1);

        deleteRecords.forEach(rec => {
          recordsToDelete.push(rec.id);
          console.log(`   - DELETE: ${rec.id} (${rec.timestamp})`);
        });

        // If the kept record doesn't have the new ID format, migrate it
        if (keepRecord.id !== key) {
          recordsToMigrate.push({
            oldId: keepRecord.id,
            newId: key,
            data: keepRecord.data
          });
          console.log(`   - MIGRATE: ${keepRecord.id} → ${key}`);
        } else {
          console.log(`   - KEEP: ${keepRecord.id} (already has correct ID)`);
        }

        duplicateCount += records.length - 1;
      } else {
        // Single record - check if it needs migration to new ID format
        const record = records[0];
        if (record.id !== key) {
          recordsToMigrate.push({
            oldId: record.id,
            newId: key,
            data: record.data
          });
        }
      }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary:`);
    console.log(`  Total records: ${snapshot.size}`);
    console.log(`  Unique keys: ${recordsByKey.size}`);
    console.log(`  Duplicates found: ${duplicateCount}`);
    console.log(`  Records to delete: ${recordsToDelete.length}`);
    console.log(`  Records to migrate: ${recordsToMigrate.length}`);
    console.log(`${'='.repeat(60)}\n`);

    // Execute cleanup in batches
    const batchSize = 500; // Firestore batch limit

    // 1. Migrate records to new IDs
    console.log('Migrating records to new ID format...');
    for (let i = 0; i < recordsToMigrate.length; i += batchSize) {
      const batch = firestore.batch();
      const batchRecords = recordsToMigrate.slice(i, i + batchSize);

      for (const record of batchRecords) {
        // Create new document with correct ID
        const newDocRef = firestore.collection('costs').doc(record.newId);
        batch.set(newDocRef, {
          ...record.data,
          createdAt: record.data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          migratedFrom: record.oldId
        });

        // Delete old document
        const oldDocRef = firestore.collection('costs').doc(record.oldId);
        batch.delete(oldDocRef);
      }

      await batch.commit();
      console.log(`  Migrated ${batchRecords.length} records (batch ${Math.floor(i / batchSize) + 1})`);
    }

    // 2. Delete duplicate records
    console.log('\nDeleting duplicate records...');
    for (let i = 0; i < recordsToDelete.length; i += batchSize) {
      const batch = firestore.batch();
      const batchIds = recordsToDelete.slice(i, i + batchSize);

      for (const id of batchIds) {
        const docRef = firestore.collection('costs').doc(id);
        batch.delete(docRef);
      }

      await batch.commit();
      console.log(`  Deleted ${batchIds.length} records (batch ${Math.floor(i / batchSize) + 1})`);
    }

    // 3. Verify final state
    const finalSnapshot = await firestore.collection('costs').get();
    console.log(`\n${'='.repeat(60)}`);
    console.log('Deduplication complete!');
    console.log(`  Records before: ${snapshot.size}`);
    console.log(`  Records after: ${finalSnapshot.size}`);
    console.log(`  Records removed: ${snapshot.size - finalSnapshot.size}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('Error during deduplication:', error);
    process.exit(1);
  }
}

// Run the deduplication
deduplicateCosts()
  .then(() => {
    console.log('✅ Deduplication process completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Deduplication process failed:', error);
    process.exit(1);
  });

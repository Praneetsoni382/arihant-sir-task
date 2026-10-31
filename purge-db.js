// Purge script to clear all test records and leave only single Administrator
import { firestoreDb } from './server/dist/firebase.js';
import { seedStore } from './server/dist/repositories/inMemoryStore.js';
import fs from 'fs';
import path from 'path';

async function purgeAll() {
  console.log('🧹 Purging all test records, tasks, queries, members, notifications, and dummy data from Firestore...');

  const collections = [
    'tasks',
    'taskMembers',
    'statusRequests',
    'statusResponses',
    'queries',
    'queryMessages',
    'chatMessages',
    'notifications',
    'auditEvents',
    'reminderOccurrences',
  ];

  for (const col of collections) {
    try {
      const docs = await firestoreDb.collectionGetAll(col);
      console.log(`   Clearing collection '${col}' (${docs.length} documents)...`);
      for (const d of docs) {
        if (d && d.id) {
          await firestoreDb.docDelete(col, d.id);
        }
      }
    } catch (err) {
      console.warn(`   Notice clearing ${col}:`, err);
    }
  }

  // Purge non-admin users from Firestore
  try {
    const users = await firestoreDb.collectionGetAll('users');
    console.log(`   Inspecting users (${users.length} documents)...`);
    for (const u of users) {
      if (u && u.email !== 'admin@company.com') {
        console.log(`   Deleting non-admin user: ${u.email} (${u.id})`);
        await firestoreDb.docDelete('users', u.id);
      }
    }
  } catch (err) {
    console.warn('   Notice clearing non-admin users:', err);
  }

  // Clear local snapshot file
  const dataDir = path.resolve(process.cwd(), '.data');
  const snapshotPath = path.resolve(dataDir, 'app-store.json');
  if (fs.existsSync(snapshotPath)) {
    fs.unlinkSync(snapshotPath);
    console.log('   Deleted local store snapshot file app-store.json');
  }

  // Seed fresh database with single admin
  await seedStore(true);
  console.log('✨ Purge complete! Database now contains only the single Administrator account (admin@company.com). Everything else is zero.');
  process.exit(0);
}

purgeAll();

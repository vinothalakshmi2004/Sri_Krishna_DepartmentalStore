/**
 * Restore a backup downloaded from Admin -> Backup into the database in MONGO_URI.
 *
 *   npm run restore -- "C:\path\to\store_backup_2026-11-05_16-30.json"
 *   npm run restore -- "C:\path\to\backup.json" --replace
 *
 * Without --replace a collection that already has documents is skipped, so
 * nothing is overwritten by accident. With --replace those collections are
 * emptied first and filled from the backup.
 *
 * The "admins" collection is never restored (backups contain no passwords).
 * Keep your current admin, or let the server create the default admin from
 * DEFAULT_ADMIN_USERNAME / DEFAULT_ADMIN_PASSWORD when there is none.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
require('./dbStructure'); // loads every model (for the indexes)

const { EJSON } = mongoose.mongo.BSON;
const SKIP = new Set(['admins']);

const run = async () => {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) {
    console.log('Usage: npm run restore -- <backup.json> [--replace]');
    process.exitCode = 1;
    return;
  }

  const backup = EJSON.parse(fs.readFileSync(path.resolve(file), 'utf8'), { relaxed: true });
  if (!backup || typeof backup.collections !== 'object') throw new Error('This file is not a store backup (no "collections" found).');
  console.log(`[restore] Backup from ${new Date(backup.exportedAt).toLocaleString()} (database "${backup.database}")`);

  await connectDB();
  const { db } = mongoose.connection;

  for (const [name, docs] of Object.entries(backup.collections)) {
    if (SKIP.has(name)) {
      console.log(`[restore] ${name}: skipped (admin passwords are not in backups)`);
      continue;
    }
    if (!Array.isArray(docs)) continue;
    const collection = db.collection(name);
    // eslint-disable-next-line no-await-in-loop
    const existing = await collection.countDocuments();
    if (existing > 0 && !replace) {
      console.log(`[restore] ${name}: skipped - it already has ${existing} document(s). Run again with --replace to overwrite.`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (existing > 0) await collection.deleteMany({});
    // eslint-disable-next-line no-await-in-loop
    if (docs.length) await collection.insertMany(docs, { ordered: true });
    console.log(`[restore] ${name}: ${docs.length} document(s) restored${existing ? ` (replaced ${existing})` : ''}`);
  }

  // Make sure every index from the models exists
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  console.log('[restore] Done');
};

run()
  .catch((err) => {
    console.error(`[restore] Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

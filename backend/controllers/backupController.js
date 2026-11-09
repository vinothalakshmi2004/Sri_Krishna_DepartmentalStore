/**
 * Database backup downloads (admin only).
 *
 *   GET /api/backup/summary    - collections and document counts (for the Backup page)
 *   GET /api/backup/data       - every collection as one JSON file (MongoDB Extended JSON,
 *                                so ObjectIds and dates survive a restore)
 *   GET /api/backup/structure  - collections, fields, types and indexes as a CSV for Excel
 *
 * Admin password hashes are never included in a backup. Restore with:
 *   npm run restore -- path/to/backup.json      (see utils/restoreBackup.js)
 */
const mongoose = require('mongoose');
const { Parser } = require('@json2csv/plainjs');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const { describeDatabase } = require('../utils/dbStructure');

const { EJSON } = mongoose.mongo.BSON;
const BACKUP_FORMAT = 'greenmart-backup-v1';

// Never written to a backup file
const SECRET_FIELDS = { admins: ['password', 'passwordChangedAt'] };

/** "Sri Krishna Department Store" -> "sri-krishna-department-store" */
const slug = (text) =>
  String(text || 'store')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'store';

/** 2026-11-05_16-30 in the server's local time */
const stamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
};

const fileBase = async () => {
  const settings = await Settings.getSingleton();
  return slug(settings.storeName);
};

/** Names of the real collections in this database (system collections skipped) */
const listCollectionNames = async () => {
  const collections = await mongoose.connection.db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
  return collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort((a, b) => a.localeCompare(b));
};

/** GET /api/backup/summary */
exports.getSummary = asyncHandler(async (req, res) => {
  const names = await listCollectionNames();
  const collections = await Promise.all(
    names.map(async (name) => ({ name, count: await mongoose.connection.db.collection(name).countDocuments() }))
  );
  res.json({
    success: true,
    data: {
      database: mongoose.connection.name,
      collections,
      totalDocuments: collections.reduce((sum, c) => sum + c.count, 0),
    },
  });
});

/** GET /api/backup/data - full backup as a .json download */
exports.downloadData = asyncHandler(async (req, res) => {
  const names = await listCollectionNames();
  const collections = {};
  const counts = {};

  for (const name of names) {
    const hidden = SECRET_FIELDS[name] || [];
    const projection = Object.fromEntries(hidden.map((field) => [field, 0]));
    // eslint-disable-next-line no-await-in-loop
    const docs = await mongoose.connection.db.collection(name).find({}, { projection }).toArray();
    collections[name] = docs;
    counts[name] = docs.length;
  }

  const backup = {
    format: BACKUP_FORMAT,
    database: mongoose.connection.name,
    exportedAt: new Date(),
    note: 'MongoDB Extended JSON. Admin passwords are not included. Product photos live in backend/uploads - copy that folder as well.',
    counts,
    structure: describeDatabase(),
    collections,
  };

  const fileName = `${await fileBase()}_backup_${stamp()}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(EJSON.stringify(backup, null, 2, { relaxed: true }));
});

/** GET /api/backup/structure - one row per field, ready for Excel */
exports.downloadStructure = asyncHandler(async (req, res) => {
  const rows = [];
  describeDatabase().forEach((collection) => {
    const indexed = new Set(collection.indexes.flatMap((index) => Object.keys(index.keys)));
    collection.fields.forEach((field) => {
      rows.push({
        collection: collection.collection,
        model: collection.model,
        field: field.field,
        type: field.type,
        required: field.required ? 'Yes' : '',
        default: field.default,
        allowedValues: field.allowedValues,
        unique: field.unique ? 'Yes' : '',
        indexed: field.indexed || indexed.has(field.field) ? 'Yes' : '',
        note: field.hiddenByDefault ? 'Secret - not sent to the browser' : '',
      });
    });
    if (collection.timestamps) {
      ['createdAt', 'updatedAt'].forEach((field) => {
        if (!collection.fields.some((f) => f.field === field)) {
          rows.push({ collection: collection.collection, model: collection.model, field, type: 'Date', note: 'Set automatically' });
        }
      });
    }
    // Compound indexes as extra rows
    collection.indexes
      .filter((index) => Object.keys(index.keys).length > 1)
      .forEach((index) => {
        rows.push({
          collection: collection.collection,
          model: collection.model,
          field: `(index) ${Object.entries(index.keys).map(([key, dir]) => `${key} ${dir === -1 ? 'desc' : 'asc'}`).join(' + ')}`,
          unique: index.unique ? 'Yes' : '',
          indexed: 'Yes',
          note: 'Combined index',
        });
      });
    rows.push({});
  });

  const csv = new Parser({
    withBOM: true,
    fields: [
      { label: 'Collection', value: 'collection' },
      { label: 'Model', value: 'model' },
      { label: 'Field', value: 'field' },
      { label: 'Type', value: 'type' },
      { label: 'Required', value: 'required' },
      { label: 'Default', value: 'default' },
      { label: 'Allowed values', value: 'allowedValues' },
      { label: 'Unique', value: 'unique' },
      { label: 'Indexed', value: 'indexed' },
      { label: 'Note', value: 'note' },
    ],
  }).parse(rows);

  const fileName = `${await fileBase()}_db-structure_${stamp()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csv);
});

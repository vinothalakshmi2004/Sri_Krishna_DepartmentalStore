/**
 * Describe the database structure from the Mongoose models: every collection,
 * its fields (type, required, default, allowed values) and its indexes.
 * Used by the admin "Backup" page (structure download) and inside backups.
 */
const mongoose = require('mongoose');

// Load every model so mongoose.models is complete
require('../models/Admin');
require('../models/Counter');
require('../models/Expense');
require('../models/Income');
require('../models/Item');
require('../models/Offer');
require('../models/Order');
require('../models/Settings');

const HIDDEN_PATHS = new Set(['__v']);

/** Short type name of a schema path: String, Number, ObjectId -> Item, [Object] ... */
const typeName = (schemaType) => {
  if (schemaType.instance === 'Array') {
    if (schemaType.schema) return 'Array of objects';
    const caster = schemaType.caster || schemaType.$embeddedSchemaType;
    return `Array of ${caster ? typeName(caster) : 'Mixed'}`;
  }
  if (schemaType.instance === 'ObjectId' || schemaType.instance === 'ObjectID') {
    return schemaType.options && schemaType.options.ref ? `ObjectId -> ${schemaType.options.ref}` : 'ObjectId';
  }
  return schemaType.instance || 'Mixed';
};

const describeDefault = (value) => {
  if (value === undefined) return '';
  if (typeof value === 'function') return value === Date.now ? 'now' : '(computed)';
  if (Array.isArray(value)) return '[]';
  if (value === null) return 'null';
  return String(value);
};

/** Fields of one schema; sub-schemas (arrays of objects) are listed as "parent.child" */
const describeFields = (schema, prefix = '') => {
  const fields = [];
  schema.eachPath((pathName, schemaType) => {
    if (HIDDEN_PATHS.has(pathName)) return;
    const name = `${prefix}${pathName}`;
    const { options = {} } = schemaType;
    const required = Boolean(options.required) || (Array.isArray(options.required) && options.required[0]);
    const enumValues = schemaType.enumValues && schemaType.enumValues.length ? schemaType.enumValues : options.enum;
    fields.push({
      field: name,
      type: typeName(schemaType),
      required: Boolean(required),
      default: describeDefault(options.default),
      allowedValues: Array.isArray(enumValues) ? enumValues.join(', ') : '',
      unique: Boolean(options.unique),
      indexed: Boolean(options.index || options.unique),
      hiddenByDefault: options.select === false,
    });
    if (schemaType.schema && pathName !== '_id') fields.push(...describeFields(schemaType.schema, `${name}[].`));
  });
  return fields;
};

/** All collections with fields and indexes, sorted by collection name */
const describeDatabase = () =>
  Object.values(mongoose.models)
    .map((model) => ({
      model: model.modelName,
      collection: model.collection.collectionName,
      timestamps: Boolean(model.schema.options.timestamps),
      fields: describeFields(model.schema),
      indexes: model.schema.indexes().map(([keys, options]) => ({ keys, ...(options || {}) })),
    }))
    .sort((a, b) => a.collection.localeCompare(b.collection));

module.exports = { describeDatabase };

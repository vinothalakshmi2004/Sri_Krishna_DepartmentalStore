/**
 * Item - a product sold in the store.
 * `stock` may be fractional for kg/litre items (e.g. 12.5 kg of rice).
 */
const mongoose = require('mongoose');
const { ITEM_UNITS } = require('../utils/constants');

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name must be at most 100 characters'],
    },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    unit: {
      type: String,
      enum: { values: ITEM_UNITS, message: `Unit must be one of: ${ITEM_UNITS.join(', ')}` },
      default: 'piece',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [50, 'Category must be at most 50 characters'],
    },
    // EAN/UPC printed on the pack - scanning it finds or adds the item. Absent when not set.
    barcode: { type: String, trim: true, maxlength: 40 },
    image: { type: String, default: '' }, // public path, e.g. /uploads/items/abc.jpg
    stock: { type: Number, default: 0, min: [0, 'Stock cannot be negative'] },
    isAvailable: { type: Boolean, default: true },
    lowStockLimit: { type: Number, default: 5, min: [0, 'Low stock limit cannot be negative'] },
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true },
  }
);

// Handy flag for the admin UI
itemSchema.virtual('isLowStock').get(function isLowStock() {
  return this.stock <= this.lowStockLimit;
});

itemSchema.index({ category: 1, name: 1 });
itemSchema.index({ isAvailable: 1 });
// One item per barcode; items without a barcode are not indexed
itemSchema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } });

/**
 * Atomically change stock by `delta` (negative to reduce).
 * An update pipeline rounds the result to 3 decimals so floating point
 * drift (0.1 + 0.2 ...) never builds up for kg/litre items.
 * `conditions` adds guards such as { stock: { $gte: qty } }.
 * Resolves to the MongoDB result - check `modifiedCount` to know if it applied.
 */
itemSchema.statics.adjustStock = function adjustStock(itemId, delta, conditions = {}) {
  return this.updateOne({ _id: itemId, ...conditions }, [
    { $set: { stock: { $round: [{ $add: ['$stock', delta] }, 3] } } },
  ]);
};

module.exports = mongoose.model('Item', itemSchema);

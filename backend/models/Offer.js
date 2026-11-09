/**
 * Offer - a promotion shown in the "Offer Zone" on the landing page.
 *
 * type "item"    -> special price on one item. While the offer is live the item
 *                   is sold at offerPrice everywhere: product list, cart and the
 *                   order total calculated by the server.
 * type "general" -> announcement only (e.g. "Free delivery this Sunday").
 *
 * An offer is live when isActive is true and now is between startDate and
 * endDate (endDate null = no end). Dates are whole days in the store's time zone.
 */
const mongoose = require('mongoose');
const { OFFER_TYPES } = require('../utils/constants');

const offerSchema = new mongoose.Schema(
  {
    type: { type: String, enum: OFFER_TYPES, default: 'general' },
    title: {
      type: String,
      required: [true, 'Offer title is required'],
      trim: true,
      maxlength: [100, 'Title must be at most 100 characters'],
    },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    badge: { type: String, trim: true, maxlength: 30, default: '' }, // e.g. "20% OFF", "Buy 1 Get 1"
    image: { type: String, default: '' }, // /uploads/offers/... (item offers fall back to the item photo)

    // Item price offers only
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    offerPrice: { type: Number, min: [0, 'Offer price cannot be negative'], default: null },

    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ type: 1, item: 1 });

module.exports = mongoose.model('Offer', offerSchema);

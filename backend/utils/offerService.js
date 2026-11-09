/**
 * Offer helpers: which offers are live, and what price a customer pays for
 * an item right now. Used by the public item list, the Offer Zone and
 * order placement, so the price shown is always the price charged.
 */
const Offer = require('../models/Offer');
const { round2 } = require('./helpers');

/** MongoDB filter for offers that are live right now */
const liveOfferFilter = (now = new Date()) => ({
  isActive: true,
  startDate: { $lte: now },
  $or: [{ endDate: null }, { endDate: { $gte: now } }],
});

/** Filters for the admin status tabs */
const STATUS_FILTERS = {
  active: (now) => liveOfferFilter(now),
  scheduled: (now) => ({ isActive: true, startDate: { $gt: now }, $or: [{ endDate: null }, { endDate: { $gte: now } }] }),
  paused: (now) => ({ isActive: false, $or: [{ endDate: null }, { endDate: { $gte: now } }] }),
  expired: (now) => ({ endDate: { $ne: null, $lt: now } }),
};

/** Active | Scheduled | Paused | Expired */
const getOfferStatus = (offer, now = new Date()) => {
  if (offer.endDate && new Date(offer.endDate) < now) return 'Expired';
  if (!offer.isActive) return 'Paused';
  if (new Date(offer.startDate) > now) return 'Scheduled';
  return 'Active';
};

/**
 * Map of itemId -> lowest live offer price (when several offers target the
 * same item, the customer gets the best one).
 * @param {Array} [itemIds] limit to these items (all items when omitted)
 */
const getLiveOfferPrices = async (itemIds) => {
  const filter = {
    ...liveOfferFilter(),
    type: 'item',
    offerPrice: { $ne: null },
    item: itemIds ? { $in: itemIds } : { $ne: null },
  };
  const offers = await Offer.find(filter).select('item offerPrice title').lean();

  const best = new Map();
  offers.forEach((offer) => {
    const key = String(offer.item);
    const current = best.get(key);
    if (!current || offer.offerPrice < current.offerPrice) {
      best.set(key, { offerPrice: offer.offerPrice, title: offer.title });
    }
  });
  return best;
};

/**
 * Price for an item with live offers applied.
 * originalPrice is only set when the offer actually lowers the price.
 */
const priceWithOffer = (item, offerPrices) => {
  const offer = offerPrices.get(String(item._id));
  if (offer && offer.offerPrice < item.price) {
    return { price: round2(offer.offerPrice), originalPrice: item.price, offerTitle: offer.title };
  }
  return { price: item.price, originalPrice: null, offerTitle: null };
};

/** "20% OFF" style percentage */
const discountPercent = (price, originalPrice) =>
  originalPrice && originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

module.exports = {
  liveOfferFilter,
  STATUS_FILTERS,
  getOfferStatus,
  getLiveOfferPrices,
  priceWithOffer,
  discountPercent,
};

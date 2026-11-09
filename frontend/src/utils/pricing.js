/**
 * Cart totals on the client. The server always recalculates the real
 * prices - these numbers are for display only.
 */
import { formatCurrency } from './format';

export const round2 = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

/** True when an item is currently sold below its regular price (live offer) */
export const hasOffer = (item) => Boolean(item && item.originalPrice && item.originalPrice > item.price);

/** 165 -> 149 = 10 (% off) */
export const discountPercent = (price, originalPrice) =>
  originalPrice && originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

/**
 * Customer-facing delivery rule from Store Settings, e.g.
 *   charge 0 + minimum 1000 -> "Free home delivery on orders of ₹1,000 & above"
 *   charge 30 + free above 500 -> "Free delivery above ₹500"
 */
export const deliveryRule = (settings) => {
  if (!settings) return '';
  const charge = Number(settings.deliveryCharge) || 0;
  const minOrder = Number(settings.minOrderAmount) || 0;
  const freeAbove = Number(settings.freeDeliveryAbove) || 0;
  if (charge === 0) return minOrder > 0 ? `Free home delivery on orders of ${formatCurrency(minOrder)} & above` : 'Free home delivery';
  if (freeAbove > 0) return `Free delivery above ${formatCurrency(freeAbove)}`;
  return `Delivery charge ${formatCurrency(charge)}`;
};

/** "Home delivery is available for orders of ₹1,000 & above." */
export const minimumOrderMessage = (minOrder) =>
  `Home delivery is available for orders of ${formatCurrency(minOrder)} & above.`;

/**
 * Delivery charge for a subtotal using store settings.
 * With own (typed-in) items the order is not empty even at subtotal 0,
 * so the charge applies just like the server does.
 */
export const calcDeliveryCharge = (subtotal, settings, { hasCustomItems = false } = {}) => {
  if (!settings || (subtotal <= 0 && !hasCustomItems)) return 0;
  const freeAbove = Number(settings.freeDeliveryAbove) || 0;
  if (freeAbove > 0 && subtotal >= freeAbove) return 0;
  return Number(settings.deliveryCharge) || 0;
};

/**
 * Everything the cart / checkout screens need to show.
 * belowMinimum + shortBy drive the "minimum order" warning,
 * freeDeliveryGap drives the "add ₹X more for free delivery" hint.
 * hasCustomItems: the cart has own (typed-in) items whose price the store sets
 * later, so the minimum order and free-delivery hints are skipped.
 */
export const calcCartTotals = (subtotal, settings, { hasCustomItems = false } = {}) => {
  const deliveryCharge = calcDeliveryCharge(subtotal, settings, { hasCustomItems });
  const minOrder = Number(settings && settings.minOrderAmount) || 0;
  const freeAbove = Number(settings && settings.freeDeliveryAbove) || 0;

  return {
    subtotal: round2(subtotal),
    deliveryCharge,
    grandTotal: round2(subtotal + deliveryCharge),
    minOrder,
    belowMinimum: !hasCustomItems && subtotal > 0 && subtotal < minOrder,
    shortBy: hasCustomItems ? 0 : round2(Math.max(minOrder - subtotal, 0)),
    freeDeliveryGap: !hasCustomItems && freeAbove > 0 && subtotal < freeAbove ? round2(freeAbove - subtotal) : 0,
  };
};

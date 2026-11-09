/**
 * Shared enum values used by models, validators and controllers.
 * Keeping them in one place guarantees the API and the database agree.
 */

// Selling units for items
const ITEM_UNITS = ['kg', 'g', 'litre', 'piece', 'packet'];

// Units that can be ordered in fractions (e.g. 0.5 kg, 1.25 litre).
// Every other unit must be ordered in whole numbers.
const FRACTIONAL_UNITS = ['kg', 'litre'];

// Order life cycle
const ORDER_STATUSES = ['New', 'Confirmed', 'OutForDelivery', 'Delivered', 'Cancelled'];

// Statuses that still need action from the store
const OPEN_ORDER_STATUSES = ['New', 'Confirmed', 'OutForDelivery'];

const PAYMENT_STATUSES = ['Pending', 'Paid'];

// Payment modes a customer can pay an order with ("None" = not paid yet)
const ORDER_PAYMENT_MODES = ['Cash', 'GPay', 'PhonePe', 'UPI', 'Other', 'None'];

// Payment modes for income / expense ledger entries
const LEDGER_PAYMENT_MODES = ['Cash', 'GPay', 'PhonePe', 'UPI', 'Card', 'BankTransfer', 'Other'];

const EXPENSE_CATEGORIES = ['Purchase', 'Salary', 'Rent', 'Electricity', 'Transport', 'Other'];

const INCOME_SOURCES = ['Order', 'Manual'];

// Social networks supported in store settings
const SOCIAL_LINK_KEYS = ['facebook', 'instagram', 'youtube', 'twitter'];

// Offer kinds: "item" = special price on one item, "general" = announcement only
const OFFER_TYPES = ['item', 'general'];
const OFFER_STATUSES = ['active', 'scheduled', 'paused', 'expired'];

// Item barcodes: EAN/UPC digits or the store's own code (letters, digits, . _ -)
const BARCODE_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;

// Website colour themes (the colours themselves live in the frontend) and the colours an admin can fine-tune
const THEME_PRESETS = ['green', 'gold', 'red', 'orange', 'blue'];
const THEME_COLOR_KEYS = ['primary', 'heading', 'text'];
// Landing page background animation styles (Website Colours page)
const ANIMATION_STYLES = ['leaves', 'bubbles', 'sparkles'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

module.exports = {
  ITEM_UNITS,
  FRACTIONAL_UNITS,
  ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  PAYMENT_STATUSES,
  ORDER_PAYMENT_MODES,
  LEDGER_PAYMENT_MODES,
  EXPENSE_CATEGORIES,
  INCOME_SOURCES,
  SOCIAL_LINK_KEYS,
  OFFER_TYPES,
  OFFER_STATUSES,
  BARCODE_PATTERN,
  THEME_PRESETS,
  THEME_COLOR_KEYS,
  ANIMATION_STYLES,
  HEX_COLOR,
};

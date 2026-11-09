/**
 * Settings - a SINGLE document holding store information shown on the
 * landing page and the rules used when accepting orders.
 */
const mongoose = require('mongoose');
const { THEME_PRESETS, ANIMATION_STYLES } = require('../utils/constants');

const settingsSchema = new mongoose.Schema(
  {
    // Fixed key + unique index guarantee there is only ever one settings document
    singletonKey: { type: String, default: 'main', unique: true, immutable: true },

    // Store information
    storeName: { type: String, trim: true, maxlength: 100, default: 'Sri Krishna Department Store' },
    tagline: { type: String, trim: true, maxlength: 150, default: '' },
    about: { type: String, trim: true, maxlength: 2000, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' }, // main number
    extraPhones: { type: [String], default: [] }, // other contact numbers
    whatsapp: { type: String, trim: true, maxlength: 20, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 100, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    mapLink: { type: String, trim: true, maxlength: 500, default: '' }, // Google Maps share link (directions)
    mapEmbedUrl: { type: String, trim: true, maxlength: 2000, default: '' }, // map shown on the website (auto-filled from mapLink)
    openingHours: { type: String, trim: true, maxlength: 200, default: '' },

    // Ordering rules
    deliveryCharge: { type: Number, min: 0, default: 0 },
    freeDeliveryAbove: { type: Number, min: 0, default: 0 }, // 0 = never free
    minOrderAmount: { type: Number, min: 0, default: 0 },
    allowedPincodes: { type: [String], default: [] }, // empty = deliver everywhere
    isStoreOpen: { type: Boolean, default: true },
    // Offers on/off for the whole website: when off, customers see no Offer Zone,
    // no offer badges and pay regular prices (offers stay saved in admin)
    offersEnabled: { type: Boolean, default: true },

    // Images (public paths under /uploads/settings)
    galleryImages: { type: [String], default: [] },
    heroImage: { type: String, default: '' },
    logo: { type: String, default: '' }, // square icon: header, admin sidebar, browser tab
    logoFull: { type: String, default: '' }, // wide logo with the store name: footer, login, printed bill

    socialLinks: {
      facebook: { type: String, trim: true, default: '' },
      instagram: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
    },

    // Website colours for the whole site and admin panel. Empty colours = the preset's own.
    theme: {
      preset: { type: String, enum: THEME_PRESETS, default: 'green' },
      primary: { type: String, trim: true, default: '' }, // buttons, links, highlights (#rrggbb)
      heading: { type: String, trim: true, default: '' }, // titles
      text: { type: String, trim: true, default: '' }, // paragraphs
    },
    // Landing page animation: floating shapes in the hero + sections sliding in on scroll
    animation: {
      enabled: { type: Boolean, default: true },
      style: { type: String, enum: ANIMATION_STYLES, default: 'leaves' },
      color: { type: String, trim: true, default: '' }, // #rrggbb, '' = the website's main colour
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.singletonKey;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/** Fetch the settings document, creating it with defaults if missing (atomic). */
settingsSchema.statics.getSingleton = function getSingleton() {
  return this.findOneAndUpdate(
    { singletonKey: 'main' },
    { $setOnInsert: { singletonKey: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);

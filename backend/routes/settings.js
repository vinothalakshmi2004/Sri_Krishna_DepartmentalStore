/**
 * Store settings + system (.env) settings routes (admin only).
 * Base path: /api/settings
 */
const express = require('express');
const { body, query } = require('express-validator');
const ctrl = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { uploadSettingsImages } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const { SOCIAL_LINK_KEYS, THEME_PRESETS, THEME_COLOR_KEYS, HEX_COLOR, ANIMATION_STYLES } = require('../utils/constants');
const { toStringArray, toPlainObject, extractEmbedSrc } = require('../utils/helpers');
const { EDITABLE_ENV_KEYS } = require('../utils/envFile');
const { isGoogleMapsLink } = require('../utils/mapLink');

const router = express.Router();
router.use(protect);

/** Optional text field with a max length */
const text = (field, max, label = field) =>
  body(field).optional({ values: 'null' })
    .isString().withMessage(`Invalid ${label}`).bail()
    .trim().isLength({ max }).withMessage(`${label} must be at most ${max} characters`);

/** Optional money field (0 or more) */
const money = (field, label) =>
  body(field).optional({ values: 'null' })
    .isFloat({ min: 0, max: 10000000 }).withMessage(`${label} must be a number of 0 or more`)
    .toFloat();

/** Optional phone-like field: digits, spaces, +, -, () */
const phoneLike = (field, label) =>
  text(field, 20, label).matches(/^[\d\s+\-()]*$/).withMessage(`${label} may only contain digits, spaces, +, - and ()`);

const settingsRules = [
  text('storeName', 100, 'Store name').notEmpty().withMessage('Store name cannot be empty'),
  text('tagline', 150, 'Tagline'),
  text('about', 2000, 'About'),
  phoneLike('phone', 'Phone'),
  body('extraPhones').optional({ values: 'null' })
    .customSanitizer(toStringArray) // array, JSON text or "9360586396,6385754323"
    .custom((list) => {
      if (list.length > 5) throw new Error('Add at most 5 other contact numbers');
      const bad = list.find((p) => !/^[\d\s+\-()]{6,20}$/.test(p));
      if (bad) throw new Error(`Invalid phone number "${bad}"`);
      return true;
    })
    .customSanitizer((list) => [...new Set(list)]),
  phoneLike('whatsapp', 'WhatsApp number'),
  text('email', 100, 'Email')
    .custom((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .withMessage('Enter a valid email address'),
  text('address', 300, 'Address'),
  body('mapLink').optional({ values: 'null' })
    .isString().withMessage('Invalid Google Maps link').bail()
    .trim()
    .isLength({ max: 500 }).withMessage('Google Maps link is too long')
    .custom((value) => value === '' || isGoogleMapsLink(value))
    .withMessage('Paste a Google Maps link, e.g. https://maps.app.goo.gl/...'),
  body('mapEmbedUrl').optional({ values: 'null' })
    .isString().withMessage('Invalid map URL').bail()
    .customSanitizer(extractEmbedSrc) // accepts a full <iframe> snippet too
    .isLength({ max: 2000 }).withMessage('Map URL is too long')
    .custom((value) => value === '' || /^https:\/\/\S+$/i.test(value))
    .withMessage('Map URL must start with https://'),
  text('openingHours', 200, 'Opening hours'),
  money('deliveryCharge', 'Delivery charge'),
  money('freeDeliveryAbove', 'Free delivery amount'),
  money('minOrderAmount', 'Minimum order amount'),
  body('isStoreOpen').optional({ values: 'null' })
    .isBoolean().withMessage('isStoreOpen must be true or false')
    .toBoolean(),
  body('offersEnabled').optional({ values: 'null' })
    .isBoolean().withMessage('offersEnabled must be true or false')
    .toBoolean(),
  body('allowedPincodes').optional({ values: 'null' })
    .customSanitizer(toStringArray) // array, JSON text or "600001,600002"
    .custom((list) => {
      if (list.length > 500) throw new Error('At most 500 pincodes are allowed');
      const bad = list.find((p) => !/^\d{6}$/.test(p));
      if (bad) throw new Error(`Invalid pincode "${bad}" - pincodes must be 6 digits`);
      return true;
    })
    .customSanitizer((list) => [...new Set(list)]),
  body('socialLinks').optional({ values: 'null' })
    .customSanitizer(toPlainObject) // object, JSON text or socialLinks[facebook]=...
    .custom((links) => {
      if (!links || typeof links !== 'object') throw new Error('socialLinks must be an object');
      Object.entries(links).forEach(([key, value]) => {
        if (!SOCIAL_LINK_KEYS.includes(key)) {
          throw new Error(`Unknown social link "${key}". Allowed: ${SOCIAL_LINK_KEYS.join(', ')}`);
        }
        if (typeof value !== 'string' || value.length > 300) throw new Error(`Invalid ${key} link`);
        if (value.trim() && !/^https?:\/\/\S+$/i.test(value.trim())) {
          throw new Error(`${key} link must start with http:// or https://`);
        }
      });
      return true;
    })
    .customSanitizer((links) =>
      Object.fromEntries(Object.entries(links).map(([key, value]) => [key, value.trim()]))
    ),
  // { preset: 'gold', primary: '#c8a351', heading: '', text: '' } - empty colour = the preset's own
  body('theme').optional({ values: 'null' })
    .customSanitizer(toPlainObject)
    .custom((theme) => {
      if (!theme || typeof theme !== 'object') throw new Error('theme must be an object');
      Object.entries(theme).forEach(([key, value]) => {
        if (key === 'preset') {
          if (!THEME_PRESETS.includes(value)) throw new Error(`Unknown colour theme "${value}". Allowed: ${THEME_PRESETS.join(', ')}`);
        } else if (!THEME_COLOR_KEYS.includes(key)) {
          throw new Error(`Unknown theme colour "${key}". Allowed: ${THEME_COLOR_KEYS.join(', ')}`);
        } else if (typeof value !== 'string' || (value && !HEX_COLOR.test(value.trim()))) {
          throw new Error(`The ${key} colour must look like #4CAF50`);
        }
      });
      return true;
    })
    .customSanitizer((theme) =>
      Object.fromEntries(Object.entries(theme).map(([key, value]) => [key, key === 'preset' ? value : value.trim().toLowerCase()]))
    ),
  // { enabled: true, style: 'bubbles', color: '#1d6fb8' } - empty colour = the main website colour
  body('animation').optional({ values: 'null' })
    .customSanitizer(toPlainObject)
    .custom((animation) => {
      if (!animation || typeof animation !== 'object') throw new Error('animation must be an object');
      Object.entries(animation).forEach(([key, value]) => {
        if (key === 'enabled') {
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') throw new Error('animation.enabled must be true or false');
        } else if (key === 'style') {
          if (!ANIMATION_STYLES.includes(value)) throw new Error(`Unknown animation style "${value}". Allowed: ${ANIMATION_STYLES.join(', ')}`);
        } else if (key === 'color') {
          if (typeof value !== 'string' || (value && !HEX_COLOR.test(value.trim()))) throw new Error('The animation colour must look like #4CAF50');
        } else {
          throw new Error(`Unknown animation setting "${key}". Allowed: enabled, style, color`);
        }
      });
      return true;
    })
    .customSanitizer((animation) =>
      Object.fromEntries(
        Object.entries(animation).map(([key, value]) => {
          if (key === 'enabled') return [key, value === true || value === 'true'];
          if (key === 'color') return [key, value.trim().toLowerCase()];
          return [key, value];
        })
      )
    ),
];

/** Values must be single-line and free of quotes so .env stays parseable */
const envSafe = (value) => {
  if (/[\r\n"'`]/.test(String(value))) throw new Error('Quotes and line breaks are not allowed');
  return true;
};

const systemRules = [
  body('MONGO_URI').optional({ values: 'falsy' })
    .isString().bail().trim()
    .matches(/^mongodb(\+srv)?:\/\/\S+$/).withMessage('MONGO_URI must start with mongodb:// or mongodb+srv://')
    .custom(envSafe),
  body('JWT_SECRET').optional({ values: 'falsy' })
    .isString().bail()
    .isLength({ min: 16, max: 256 }).withMessage('JWT_SECRET must be 16 to 256 characters')
    .matches(/^\S+$/).withMessage('JWT_SECRET cannot contain spaces')
    .custom(envSafe),
  body('JWT_EXPIRES_IN').optional({ values: 'falsy' })
    .isString().bail().trim()
    .matches(/^\d+(ms|s|m|h|d|w|y)?$/).withMessage('JWT_EXPIRES_IN must look like 7d, 12h, 30m or a number of seconds'),
  body('PORT').optional({ values: 'falsy' })
    .isInt({ min: 1, max: 65535 }).withMessage('PORT must be between 1 and 65535'),
  body('CLIENT_URL').optional({ values: 'falsy' })
    .isString().bail().trim()
    .custom((value) => value.split(',').every((url) => /^https?:\/\/[^\s,]+$/.test(url.trim())))
    .withMessage('CLIENT_URL must be one or more http(s) URLs separated by commas')
    .custom(envSafe),
  body().custom((value) => {
    if (!EDITABLE_ENV_KEYS.some((key) => value[key] !== undefined)) {
      throw new Error(`Send at least one of: ${EDITABLE_ENV_KEYS.join(', ')}`);
    }
    return true;
  }),
];

router.get('/', ctrl.getSettings);
router.put('/', uploadSettingsImages, settingsRules, validate, ctrl.updateSettings);

router.delete(
  '/image',
  [
    query('type').isIn(['logo', 'logoFull', 'heroImage', 'gallery']).withMessage('type must be logo, logoFull, heroImage or gallery'),
    query('url')
      .if(query('type').equals('gallery'))
      .isString().withMessage('url of the gallery image is required').bail()
      .notEmpty().withMessage('url of the gallery image is required'),
  ],
  validate,
  ctrl.deleteImage
);

router.get('/system', ctrl.getSystemSettings);
router.put('/system', systemRules, validate, ctrl.updateSystemSettings);

module.exports = router;

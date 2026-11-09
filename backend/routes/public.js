/**
 * Public routes - used by the customer landing page, no login needed.
 * Base path: /api/public
 */
const express = require('express');
const { body, param, query } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const ctrl = require('../controllers/publicController');
const { validate } = require('../middleware/validate');
const { normalizePhone } = require('../utils/helpers');

const router = express.Router();

// Anti-spam: limit how many orders one IP can place
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.ORDER_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many orders from this device. Please wait a few minutes or call the store.',
  },
});

const placeOrderRules = [
  body('customerName')
    .isString().withMessage('Name is required').bail()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  body('phone')
    .customSanitizer(normalizePhone)
    .matches(/^\d{10}$/).withMessage('Enter a valid 10-digit phone number'),
  body('address')
    .isString().withMessage('Address is required').bail()
    .trim()
    .isLength({ min: 5, max: 300 }).withMessage('Address must be 5 to 300 characters'),
  body('landmark').optional({ values: 'null' })
    .isString().withMessage('Invalid landmark').bail()
    .trim()
    .isLength({ max: 120 }).withMessage('Landmark must be at most 120 characters'),
  body('pincode')
    .customSanitizer((v) => (v === undefined || v === null ? v : String(v).trim()))
    .matches(/^\d{6}$/).withMessage('Enter a valid 6-digit pincode'),
  body('note').optional({ values: 'null' })
    .isString().withMessage('Invalid note').bail()
    .trim()
    .isLength({ max: 300 }).withMessage('Note must be at most 300 characters'),
  body('items').optional({ values: 'null' })
    .isArray({ max: 50 }).withMessage('Cart can contain at most 50 items'),
  // "Your own order": items the customer typed in themselves
  body('customItems').optional({ values: 'null' })
    .isArray({ max: 30 }).withMessage('Your own list can contain at most 30 items'),
  body('customItems.*.name')
    .isString().withMessage('Please type the item name').bail()
    .trim()
    .isLength({ min: 1, max: 80 }).withMessage('Item name must be 1 to 80 characters'),
  body('customItems.*.quantity').optional({ values: 'null' })
    .isString().withMessage('Invalid quantity').bail()
    .trim()
    .isLength({ max: 40 }).withMessage('Quantity must be at most 40 characters'),
  body('items').custom((items, { req }) => {
    const count = (Array.isArray(items) ? items.length : 0) + (Array.isArray(req.body.customItems) ? req.body.customItems.length : 0);
    if (count === 0) throw new Error('Your cart is empty. Please add at least one item.');
    return true;
  }),
  body('items.*.itemId')
    .isMongoId().withMessage('Invalid item in cart'),
  body('items.*.quantity')
    .isFloat({ gt: 0, max: 1000 }).withMessage('Quantity must be more than 0 and at most 1000')
    .toFloat(),
];

router.get('/settings', ctrl.getPublicSettings);

router.get(
  '/items',
  [
    query('category').optional({ values: 'falsy' }).isString().trim().isLength({ max: 50 }),
    query('search').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    query('inStock').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('inStock must be true or false'),
  ],
  validate,
  ctrl.getPublicItems
);

router.get('/categories', ctrl.getPublicCategories);

// Live offers for the landing page "Offer Zone"
router.get('/offers', ctrl.getPublicOffers);

router.post('/orders', orderLimiter, placeOrderRules, validate, ctrl.placeOrder);

// Order tracking is limited so phone numbers cannot be guessed
// (the track page refreshes every 30 s, well inside this limit)
const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many tracking requests. Please try again in a few minutes.' },
});

router.get(
  '/orders/track/:orderId',
  trackLimiter,
  [
    param('orderId').trim().toUpperCase()
      .matches(/^ORD-\d{4,}$/).withMessage('Enter a valid order ID, for example ORD-0001'),
    query('phone')
      .customSanitizer(normalizePhone)
      .matches(/^\d{10}$/).withMessage('Enter the 10-digit phone number used for the order'),
  ],
  validate,
  ctrl.trackOrder
);

module.exports = router;

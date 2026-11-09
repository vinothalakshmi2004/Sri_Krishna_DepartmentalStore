/**
 * Offer routes (admin only).
 * Base path: /api/offers
 * Create/update accept multipart/form-data with an optional "image" file.
 */
const express = require('express');
const { body, query } = require('express-validator');
const ctrl = require('../controllers/offerController');
const { protect } = require('../middleware/auth');
const { uploadOfferImage } = require('../middleware/upload');
const { validate, mongoIdParam, searchRule } = require('../middleware/validate');
const { OFFER_TYPES, OFFER_STATUSES } = require('../utils/constants');
const { parseDate } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const isDate = (value) => Boolean(parseDate(value));

const offerRules = (isUpdate) => [
  (isUpdate ? body('type').optional({ values: 'falsy' }) : body('type'))
    .isIn(OFFER_TYPES).withMessage('type must be "item" (special price) or "general" (announcement)'),
  body('title').optional({ values: 'null' })
    .isString().withMessage('Invalid title').bail()
    .trim().isLength({ max: 100 }).withMessage('Title must be at most 100 characters'),
  body('description').optional({ values: 'null' })
    .isString().withMessage('Invalid description').bail()
    .trim().isLength({ max: 500 }).withMessage('Description must be at most 500 characters'),
  body('badge').optional({ values: 'null' })
    .isString().withMessage('Invalid badge').bail()
    .trim().isLength({ max: 30 }).withMessage('Badge must be at most 30 characters'),
  body('item').optional({ values: 'falsy' })
    .isMongoId().withMessage('Choose a valid item'),
  body('offerPrice').optional({ values: 'falsy' })
    .isFloat({ gt: 0, max: 10000000 }).withMessage('Offer price must be more than 0')
    .toFloat(),
  body('startDate').optional({ values: 'falsy' })
    .custom(isDate).withMessage('Invalid start date (use YYYY-MM-DD)')
    .customSanitizer(parseDate),
  // "" means "no end date"
  body('endDate').optional({ values: 'null' })
    .custom((value) => value === '' || isDate(value)).withMessage('Invalid end date (use YYYY-MM-DD)')
    .customSanitizer((value) => (value === '' ? '' : parseDate(value))),
  body('isActive').optional({ values: 'null' })
    .isBoolean().withMessage('isActive must be true or false')
    .toBoolean(),
  body('removeImage').optional({ values: 'null' })
    .isBoolean().withMessage('removeImage must be true or false')
    .toBoolean(),
];

router.get(
  '/',
  [
    query('status').optional({ values: 'falsy' })
      .isIn(OFFER_STATUSES).withMessage(`status must be one of: ${OFFER_STATUSES.join(', ')}`),
    searchRule,
  ],
  validate,
  ctrl.getOffers
);

router.get('/:id', mongoIdParam('id', 'offer ID'), validate, ctrl.getOffer);
router.post('/', uploadOfferImage, offerRules(false), validate, ctrl.createOffer);
router.put('/:id', uploadOfferImage, [mongoIdParam('id', 'offer ID'), ...offerRules(true)], validate, ctrl.updateOffer);
router.patch(
  '/:id/toggle',
  [mongoIdParam('id', 'offer ID'), body('isActive').optional({ values: 'null' }).isBoolean().toBoolean()],
  validate,
  ctrl.toggleOffer
);
router.patch('/:id/repeat-today', mongoIdParam('id', 'offer ID'), validate, ctrl.repeatToday);
router.delete('/:id', mongoIdParam('id', 'offer ID'), validate, ctrl.deleteOffer);

module.exports = router;

/**
 * Item management routes (admin only).
 * Base path: /api/items
 *
 * Create/update accept multipart/form-data so an image can be uploaded in
 * the "image" field. JSON bodies work too when no image is sent.
 */
const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/itemController');
const { protect } = require('../middleware/auth');
const { uploadItemImage } = require('../middleware/upload');
const { validate, mongoIdParam, paginationRules, searchRule } = require('../middleware/validate');
const { ITEM_UNITS, BARCODE_PATTERN } = require('../utils/constants');

const BARCODE_MESSAGE = 'Barcode must be 3-40 letters or numbers';

const router = express.Router();
router.use(protect);

/** Shared create/update rules. On update every field is optional. */
const itemRules = (isUpdate) => {
  const required = (chain) => (isUpdate ? chain.optional({ values: 'null' }) : chain);
  return [
    required(body('name'))
      .isString().withMessage('Item name is required').bail()
      .trim().notEmpty().withMessage('Item name is required')
      .isLength({ max: 100 }).withMessage('Item name must be at most 100 characters'),
    body('description').optional({ values: 'null' })
      .isString().withMessage('Invalid description').bail()
      .trim().isLength({ max: 500 }).withMessage('Description must be at most 500 characters'),
    required(body('price'))
      .isFloat({ min: 0, max: 10000000 }).withMessage('Price must be a number of 0 or more')
      .toFloat(),
    body('unit').optional({ values: 'null' })
      .isIn(ITEM_UNITS).withMessage(`Unit must be one of: ${ITEM_UNITS.join(', ')}`),
    required(body('category'))
      .isString().withMessage('Category is required').bail()
      .trim().notEmpty().withMessage('Category is required')
      .isLength({ max: 50 }).withMessage('Category must be at most 50 characters'),
    body('stock').optional({ values: 'null' })
      .isFloat({ min: 0, max: 10000000 }).withMessage('Stock must be a number of 0 or more')
      .toFloat(),
    // Empty string clears the barcode
    body('barcode').optional({ values: 'null' })
      .isString().withMessage(BARCODE_MESSAGE).bail()
      .trim()
      .custom((value) => value === '' || BARCODE_PATTERN.test(value)).withMessage(BARCODE_MESSAGE),
    body('isAvailable').optional({ values: 'null' })
      .isBoolean().withMessage('isAvailable must be true or false')
      .toBoolean(),
    body('lowStockLimit').optional({ values: 'null' })
      .isFloat({ min: 0, max: 10000000 }).withMessage('Low stock limit must be a number of 0 or more')
      .toFloat(),
    body('removeImage').optional({ values: 'null' })
      .isBoolean().withMessage('removeImage must be true or false')
      .toBoolean(),
  ];
};

router.get(
  '/',
  [
    searchRule,
    query('category').optional({ values: 'falsy' }).isString().trim().isLength({ max: 50 }),
    query('isAvailable').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('isAvailable must be true or false'),
    query('lowStock').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('lowStock must be true or false'),
    ...paginationRules,
  ],
  validate,
  ctrl.getItems
);

router.get('/categories', ctrl.getCategories);

router.get(
  '/barcode/:code',
  param('code').trim().matches(BARCODE_PATTERN).withMessage(BARCODE_MESSAGE),
  validate,
  ctrl.lookupBarcode
);

router.get('/:id', mongoIdParam('id', 'item ID'), validate, ctrl.getItem);

router.post('/', uploadItemImage, itemRules(false), validate, ctrl.createItem);

router.put('/:id', uploadItemImage, [mongoIdParam('id', 'item ID'), ...itemRules(true)], validate, ctrl.updateItem);

router.delete('/:id', mongoIdParam('id', 'item ID'), validate, ctrl.deleteItem);

router.patch(
  '/:id/toggle-availability',
  [
    mongoIdParam('id', 'item ID'),
    body('isAvailable').optional({ values: 'null' })
      .isBoolean().withMessage('isAvailable must be true or false')
      .toBoolean(),
  ],
  validate,
  ctrl.toggleAvailability
);

router.patch(
  '/:id/stock',
  [
    mongoIdParam('id', 'item ID'),
    body('stock').optional({ values: 'null' })
      .isFloat({ min: 0, max: 10000000 }).withMessage('Stock must be a number of 0 or more')
      .toFloat(),
    body('adjustBy').optional({ values: 'null' })
      .isFloat({ min: -10000000, max: 10000000 }).withMessage('adjustBy must be a number')
      .bail()
      .custom((value) => Number(value) !== 0).withMessage('adjustBy cannot be 0')
      .toFloat(),
    body('lowStockLimit').optional({ values: 'null' })
      .isFloat({ min: 0, max: 10000000 }).withMessage('Low stock limit must be a number of 0 or more')
      .toFloat(),
    body().custom((value) => {
      const has = (key) => value[key] !== undefined && value[key] !== null;
      if (has('stock') && has('adjustBy')) throw new Error('Send either "stock" or "adjustBy", not both');
      if (!has('stock') && !has('adjustBy') && !has('lowStockLimit')) {
        throw new Error('Send "stock" (new total), "adjustBy" (+/- change) or "lowStockLimit"');
      }
      return true;
    }),
  ],
  validate,
  ctrl.updateStock
);

module.exports = router;

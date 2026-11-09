/**
 * Order management routes (admin only).
 * Base path: /api/orders
 * :id may be the MongoDB _id or the readable order ID (ORD-0001).
 */
const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { validate, paginationRules, dateRangeRules, searchRule } = require('../middleware/validate');
const { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_PAYMENT_MODES } = require('../utils/constants');
const { isObjectId } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const orderIdParam = param('id')
  .custom((value) => isObjectId(value) || /^ORD-\d+$/i.test(value))
  .withMessage('Invalid order ID');

router.get(
  '/',
  [
    query('status').optional({ values: 'falsy' })
      .custom((value) => String(value).split(',').every((s) => ORDER_STATUSES.includes(s.trim())))
      .withMessage(`status must be one or more of: ${ORDER_STATUSES.join(', ')}`),
    query('paymentStatus').optional({ values: 'falsy' })
      .isIn(PAYMENT_STATUSES).withMessage(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`),
    query('paymentMode').optional({ values: 'falsy' })
      .isIn(ORDER_PAYMENT_MODES).withMessage(`paymentMode must be one of: ${ORDER_PAYMENT_MODES.join(', ')}`),
    searchRule,
    ...dateRangeRules,
    ...paginationRules,
  ],
  validate,
  ctrl.getOrders
);

router.get('/:id', orderIdParam, validate, ctrl.getOrder);

router.patch(
  '/:id/status',
  [
    orderIdParam,
    body('status').isIn(ORDER_STATUSES).withMessage(`status must be one of: ${ORDER_STATUSES.join(', ')}`),
    body('note').optional({ values: 'null' })
      .isString().withMessage('Invalid note').bail()
      .trim().isLength({ max: 300 }).withMessage('Note must be at most 300 characters'),
  ],
  validate,
  ctrl.updateStatus
);

router.patch(
  '/:id/payment',
  [
    orderIdParam,
    body('paymentStatus').isIn(PAYMENT_STATUSES).withMessage(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`),
    body('paymentMode').optional({ values: 'null' })
      .isIn(ORDER_PAYMENT_MODES).withMessage(`paymentMode must be one of: ${ORDER_PAYMENT_MODES.join(', ')}`),
  ],
  validate,
  ctrl.updatePayment
);

router.patch(
  '/:id/note',
  [
    orderIdParam,
    body('adminNote').isString().withMessage('adminNote is required (send "" to clear it)').bail()
      .trim().isLength({ max: 500 }).withMessage('Note must be at most 500 characters'),
  ],
  validate,
  ctrl.updateNote
);

router.patch(
  '/:id/customer-message',
  [
    orderIdParam,
    body('customerMessage').isString().withMessage('customerMessage is required (send "" to remove it)').bail()
      .trim().isLength({ max: 500 }).withMessage('Message must be at most 500 characters'),
  ],
  validate,
  ctrl.updateCustomerMessage
);

// Price the items the customer typed in themselves ("Your own order")
router.patch(
  '/:id/custom-items',
  [
    orderIdParam,
    body('amounts').isArray({ max: 30 }).withMessage('amounts must be a list'),
    body('amounts.*')
      .custom((value) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000))
      .withMessage('Each price must be empty or a number between 0 and 10,00,000'),
  ],
  validate,
  ctrl.updateCustomItems
);

router.patch(
  '/:id/cancel',
  [
    orderIdParam,
    body('reason').optional({ values: 'null' })
      .isString().withMessage('Invalid reason').bail()
      .trim().isLength({ max: 300 }).withMessage('Reason must be at most 300 characters'),
  ],
  validate,
  ctrl.cancelOrder
);

router.delete('/:id', orderIdParam, validate, ctrl.deleteOrder);

module.exports = router;

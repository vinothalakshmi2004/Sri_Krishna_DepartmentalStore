/**
 * CSV report routes (admin only).
 * Base path: /api/reports
 */
const express = require('express');
const { query } = require('express-validator');
const ctrl = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { validate, dateRangeRules, searchRule } = require('../middleware/validate');
const {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ORDER_PAYMENT_MODES,
  INCOME_SOURCES,
  EXPENSE_CATEGORIES,
} = require('../utils/constants');

const router = express.Router();
router.use(protect);

router.get(
  '/orders',
  [
    ...dateRangeRules,
    // Same filters as the admin order list (GET /api/orders)
    query('status').optional({ values: 'falsy' })
      .custom((value) => String(value).split(',').every((s) => ORDER_STATUSES.includes(s.trim())))
      .withMessage(`status must be one or more of: ${ORDER_STATUSES.join(', ')}`),
    query('paymentStatus').optional({ values: 'falsy' })
      .isIn(PAYMENT_STATUSES).withMessage(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`),
    query('paymentMode').optional({ values: 'falsy' })
      .isIn(ORDER_PAYMENT_MODES).withMessage(`paymentMode must be one of: ${ORDER_PAYMENT_MODES.join(', ')}`),
    searchRule,
    query('format').optional({ values: 'falsy' })
      .isIn(['summary', 'items']).withMessage('format must be "summary" or "items"'),
  ],
  validate,
  ctrl.exportOrders
);

router.get(
  '/income',
  [
    ...dateRangeRules,
    query('source').optional({ values: 'falsy' })
      .isIn(INCOME_SOURCES).withMessage(`source must be one of: ${INCOME_SOURCES.join(', ')}`),
  ],
  validate,
  ctrl.exportIncome
);

router.get(
  '/expenses',
  [
    ...dateRangeRules,
    query('category').optional({ values: 'falsy' })
      .isIn(EXPENSE_CATEGORIES).withMessage(`category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
  ],
  validate,
  ctrl.exportExpenses
);

module.exports = router;

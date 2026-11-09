/**
 * Income routes (admin only).
 * Base path: /api/income
 * Only "Manual" entries can be created, edited or deleted here.
 */
const express = require('express');
const { body, query } = require('express-validator');
const ctrl = require('../controllers/incomeController');
const { protect } = require('../middleware/auth');
const { validate, mongoIdParam, paginationRules, dateRangeRules, searchRule } = require('../middleware/validate');
const { INCOME_SOURCES, LEDGER_PAYMENT_MODES } = require('../utils/constants');
const { parseDate } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const incomeRules = (isUpdate) => {
  const required = (chain) => (isUpdate ? chain.optional({ values: 'null' }) : chain);
  return [
    required(body('amount'))
      .isFloat({ gt: 0, max: 1000000000 }).withMessage('Amount must be more than 0')
      .toFloat(),
    body('date').optional({ values: 'falsy' })
      .custom((value) => Boolean(parseDate(value))).withMessage('Invalid date (use YYYY-MM-DD)')
      .customSanitizer(parseDate),
    body('paymentMode').optional({ values: 'null' })
      .isIn(LEDGER_PAYMENT_MODES).withMessage(`Payment mode must be one of: ${LEDGER_PAYMENT_MODES.join(', ')}`),
    body('note').optional({ values: 'null' })
      .isString().withMessage('Invalid note').bail()
      .trim().isLength({ max: 500 }).withMessage('Note must be at most 500 characters'),
  ];
};

router.get(
  '/',
  [
    query('source').optional({ values: 'falsy' })
      .isIn(INCOME_SOURCES).withMessage(`source must be one of: ${INCOME_SOURCES.join(', ')}`),
    query('paymentMode').optional({ values: 'falsy' })
      .isIn(LEDGER_PAYMENT_MODES).withMessage(`paymentMode must be one of: ${LEDGER_PAYMENT_MODES.join(', ')}`),
    searchRule,
    ...dateRangeRules,
    ...paginationRules,
  ],
  validate,
  ctrl.getIncomes
);

router.get('/:id', mongoIdParam('id', 'income ID'), validate, ctrl.getIncome);
router.post('/', incomeRules(false), validate, ctrl.createIncome);
router.put('/:id', [mongoIdParam('id', 'income ID'), ...incomeRules(true)], validate, ctrl.updateIncome);
router.delete('/:id', mongoIdParam('id', 'income ID'), validate, ctrl.deleteIncome);

module.exports = router;

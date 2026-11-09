/**
 * Expense routes (admin only).
 * Base path: /api/expenses
 */
const express = require('express');
const { body, query } = require('express-validator');
const ctrl = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const { validate, mongoIdParam, paginationRules, dateRangeRules, searchRule } = require('../middleware/validate');
const { EXPENSE_CATEGORIES, LEDGER_PAYMENT_MODES } = require('../utils/constants');
const { parseDate } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const expenseRules = (isUpdate) => {
  const required = (chain) => (isUpdate ? chain.optional({ values: 'null' }) : chain);
  return [
    required(body('title'))
      .isString().withMessage('Title is required').bail()
      .trim().notEmpty().withMessage('Title is required')
      .isLength({ max: 120 }).withMessage('Title must be at most 120 characters'),
    required(body('category'))
      .isIn(EXPENSE_CATEGORIES).withMessage(`Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
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
    query('category').optional({ values: 'falsy' })
      .isIn(EXPENSE_CATEGORIES).withMessage(`category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
    query('paymentMode').optional({ values: 'falsy' })
      .isIn(LEDGER_PAYMENT_MODES).withMessage(`paymentMode must be one of: ${LEDGER_PAYMENT_MODES.join(', ')}`),
    searchRule,
    ...dateRangeRules,
    ...paginationRules,
  ],
  validate,
  ctrl.getExpenses
);

router.get('/:id', mongoIdParam('id', 'expense ID'), validate, ctrl.getExpense);
router.post('/', expenseRules(false), validate, ctrl.createExpense);
router.put('/:id', [mongoIdParam('id', 'expense ID'), ...expenseRules(true)], validate, ctrl.updateExpense);
router.delete('/:id', mongoIdParam('id', 'expense ID'), validate, ctrl.deleteExpense);

module.exports = router;

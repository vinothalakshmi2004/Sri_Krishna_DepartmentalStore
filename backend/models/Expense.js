/**
 * Expense - money going out of the store (purchases, salary, rent ...).
 */
const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES, LEDGER_PAYMENT_MODES } = require('../utils/constants');

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: EXPENSE_CATEGORIES, message: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` },
    },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0, 'Amount cannot be negative'] },
    date: { type: Date, default: Date.now },
    paymentMode: { type: String, enum: LEDGER_PAYMENT_MODES, default: 'Cash' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

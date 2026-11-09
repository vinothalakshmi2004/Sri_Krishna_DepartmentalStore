/**
 * Income - money coming into the store.
 *
 * source = "Order"  -> created automatically when an order is Delivered + Paid
 *                      (and removed automatically if that is undone).
 * source = "Manual" -> entered by the admin (e.g. bulk sale, scrap sale).
 */
const mongoose = require('mongoose');
const { INCOME_SOURCES, LEDGER_PAYMENT_MODES } = require('../utils/constants');

const incomeSchema = new mongoose.Schema(
  {
    source: { type: String, enum: INCOME_SOURCES, default: 'Manual' },
    orderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0, 'Amount cannot be negative'] },
    date: { type: Date, default: Date.now },
    paymentMode: { type: String, enum: LEDGER_PAYMENT_MODES, default: 'Cash' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// At most ONE automatic income entry per order (prevents duplicates)
incomeSchema.index(
  { orderRef: 1 },
  { unique: true, partialFilterExpression: { source: 'Order' } }
);
incomeSchema.index({ date: -1 });
incomeSchema.index({ source: 1, date: -1 });

module.exports = mongoose.model('Income', incomeSchema);

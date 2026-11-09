/**
 * Income management (admin).
 *
 * Entries with source "Order" are created/removed automatically from orders
 * and are read-only here. Only "Manual" entries can be added, edited or deleted.
 */
const { matchedData } = require('express-validator');
const Income = require('../models/Income');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {
  escapeRegex,
  round2,
  buildDateFilter,
  getPagination,
  paginationMeta,
  buildSort,
} = require('../utils/helpers');

const SORT_FIELDS = ['date', 'amount', 'source', 'createdAt'];
const ORDER_FIELDS = 'orderId customerName phone grandTotal status';

const findIncomeOr404 = async (id) => {
  const income = await Income.findById(id);
  if (!income) throw new AppError('Income entry not found', 404);
  return income;
};

/** Block changes to automatic entries. */
const ensureManual = (income) => {
  if (income.source !== 'Manual') {
    throw new AppError(
      'This income entry was created automatically from an order. Change the order status or payment instead.',
      400
    );
  }
};

/**
 * GET /api/income?source=Order|Manual&paymentMode=&from=&to=&search=&page=&limit=&sort=-date
 * Also returns totalAmount for the whole filtered result.
 */
exports.getIncomes = asyncHandler(async (req, res) => {
  const { source, paymentMode, from, to, search, sort } = req.query;
  const filter = {};

  if (source) filter.source = String(source);
  if (paymentMode) filter.paymentMode = String(paymentMode);
  const date = buildDateFilter(from, to);
  if (date) filter.date = date;
  if (search) filter.note = new RegExp(escapeRegex(search), 'i');

  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const sortBy = buildSort(sort, SORT_FIELDS, { date: -1, _id: -1 });

  const [incomes, total, sourceRows] = await Promise.all([
    Income.find(filter).populate('orderRef', ORDER_FIELDS).sort(sortBy).skip(skip).limit(limit).lean(),
    Income.countDocuments(filter),
    // Totals per source (Order / Manual) for the whole filtered result
    Income.aggregate([{ $match: filter }, { $group: { _id: '$source', sum: { $sum: '$amount' } } }]),
  ]);

  const sourceSummary = { Order: 0, Manual: 0 };
  sourceRows.forEach((row) => { sourceSummary[row._id] = round2(row.sum); });

  res.json({
    success: true,
    data: incomes,
    totalAmount: round2(sourceRows.reduce((sum, row) => sum + row.sum, 0)),
    sourceSummary,
    pagination: paginationMeta(total, page, limit),
  });
});

/** GET /api/income/:id */
exports.getIncome = asyncHandler(async (req, res) => {
  const income = await findIncomeOr404(req.params.id);
  await income.populate('orderRef', ORDER_FIELDS);
  res.json({ success: true, data: income });
});

/** POST /api/income  { amount, date?, paymentMode?, note? }  (always "Manual") */
exports.createIncome = asyncHandler(async (req, res) => {
  const data = matchedData(req, { locations: ['body'] });
  const income = await Income.create({
    ...data,
    amount: round2(data.amount),
    source: 'Manual',
    orderRef: null,
  });
  res.status(201).json({ success: true, message: 'Income added', data: income });
});

/** PUT /api/income/:id  (manual entries only) */
exports.updateIncome = asyncHandler(async (req, res) => {
  const income = await findIncomeOr404(req.params.id);
  ensureManual(income);

  const data = matchedData(req, { locations: ['body'] });
  if (data.amount !== undefined) data.amount = round2(data.amount);
  income.set(data);
  await income.save();

  res.json({ success: true, message: 'Income updated', data: income });
});

/** DELETE /api/income/:id  (manual entries only) */
exports.deleteIncome = asyncHandler(async (req, res) => {
  const income = await findIncomeOr404(req.params.id);
  ensureManual(income);
  await income.deleteOne();
  res.json({ success: true, message: 'Income deleted', data: { _id: income._id } });
});

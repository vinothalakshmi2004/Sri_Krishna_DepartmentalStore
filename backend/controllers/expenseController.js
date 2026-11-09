/**
 * Expense management (admin).
 */
const { matchedData } = require('express-validator');
const Expense = require('../models/Expense');
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

const SORT_FIELDS = ['date', 'amount', 'title', 'category', 'createdAt'];

const findExpenseOr404 = async (id) => {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError('Expense not found', 404);
  return expense;
};

/**
 * GET /api/expenses?category=&paymentMode=&from=&to=&search=&page=&limit=&sort=-date
 * Also returns totalAmount for the whole filtered result (not just the page).
 */
exports.getExpenses = asyncHandler(async (req, res) => {
  const { category, paymentMode, from, to, search, sort } = req.query;
  const filter = {};

  if (category) filter.category = String(category);
  if (paymentMode) filter.paymentMode = String(paymentMode);
  const date = buildDateFilter(from, to);
  if (date) filter.date = date;
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: regex }, { note: regex }];
  }

  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const sortBy = buildSort(sort, SORT_FIELDS, { date: -1, _id: -1 });

  const [expenses, total, categoryRows] = await Promise.all([
    Expense.find(filter).sort(sortBy).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
    // Per-category totals for the whole filtered result (summary chart)
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const categorySummary = categoryRows.map((row) => ({
    category: row._id,
    total: round2(row.total),
    count: row.count,
  }));

  res.json({
    success: true,
    data: expenses,
    totalAmount: round2(categoryRows.reduce((sum, row) => sum + row.total, 0)),
    categorySummary,
    pagination: paginationMeta(total, page, limit),
  });
});

/** GET /api/expenses/:id */
exports.getExpense = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await findExpenseOr404(req.params.id) });
});

/** POST /api/expenses  { title, category, amount, date?, paymentMode?, note? } */
exports.createExpense = asyncHandler(async (req, res) => {
  const data = matchedData(req, { locations: ['body'] });
  if (data.amount !== undefined) data.amount = round2(data.amount);
  const expense = await Expense.create(data);
  res.status(201).json({ success: true, message: 'Expense added', data: expense });
});

/** PUT /api/expenses/:id */
exports.updateExpense = asyncHandler(async (req, res) => {
  const expense = await findExpenseOr404(req.params.id);
  const data = matchedData(req, { locations: ['body'] });
  if (data.amount !== undefined) data.amount = round2(data.amount);
  expense.set(data);
  await expense.save();
  res.json({ success: true, message: 'Expense updated', data: expense });
});

/** DELETE /api/expenses/:id */
exports.deleteExpense = asyncHandler(async (req, res) => {
  const expense = await findExpenseOr404(req.params.id);
  await expense.deleteOne();
  res.json({ success: true, message: 'Expense deleted', data: { _id: expense._id } });
});

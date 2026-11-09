/**
 * Dashboard statistics (admin).
 */
const Order = require('../models/Order');
const Item = require('../models/Item');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { OPEN_ORDER_STATUSES, ORDER_STATUSES } = require('../utils/constants');
const {
  round2,
  parseDate,
  startOfDay,
  endOfDay,
  toDateKey,
  getTimezoneOffsetString,
} = require('../utils/helpers');

/**
 * Resolve ?range=today|week|month|custom into concrete dates.
 *   today  - since midnight
 *   week   - since Monday of this week
 *   month  - since the 1st of this month
 *   custom - ?from=YYYY-MM-DD&to=YYYY-MM-DD (both required, inclusive)
 */
const resolveRange = (range, from, to) => {
  const now = new Date();
  let start;
  let end = endOfDay(now);

  switch (range) {
    case 'week': {
      start = startOfDay(now);
      const daysSinceMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysSinceMonday);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'custom': {
      const fromDate = parseDate(from);
      const toDate = parseDate(to);
      if (!fromDate || !toDate) {
        throw new AppError('Custom range needs valid "from" and "to" dates (YYYY-MM-DD)', 400);
      }
      start = startOfDay(fromDate);
      end = endOfDay(toDate);
      if (start > end) throw new AppError('"from" date must be on or before "to" date', 400);
      break;
    }
    default:
      start = startOfDay(now);
  }
  return { type: range, from: start, to: end };
};

/** Group a ledger collection (Income / Expense) into daily totals. */
const dailyLedgerTotals = (Model, since, timezone) =>
  Model.aggregate([
    { $match: { date: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
        total: { $sum: '$amount' },
      },
    },
  ]);

/**
 * Daily orders, sales, income and expense for the last `days` days,
 * with empty days filled with 0.
 */
const buildDailySeries = ({ orderRows, incomeRows, expenseRows }, days) => {
  const orders = new Map(orderRows.map((row) => [row._id, row]));
  const income = new Map(incomeRows.map((row) => [row._id, row.total]));
  const expense = new Map(expenseRows.map((row) => [row._id, row.total]));
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(12, 0, 0, 0); // midday avoids DST edge cases
    day.setDate(day.getDate() - i);
    const key = toDateKey(day);
    const row = orders.get(key);
    series.push({
      date: key,
      label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      orders: row ? row.orders : 0,
      sales: row ? round2(row.sales) : 0,
      income: round2(income.get(key) || 0),
      expense: round2(expense.get(key) || 0),
    });
  }
  return series;
};

/**
 * GET /api/dashboard/stats?range=today|week|month|custom&from=&to=
 *
 * Range based: order counts, sales, income, expense, profit, pending payments,
 * top 5 items and payment mode split.
 * Always current: low stock items, open order counts, last 7/30 day charts.
 */
exports.getStats = asyncHandler(async (req, res) => {
  const range = resolveRange(req.query.range || 'today', req.query.from, req.query.to);

  const inRange = { $gte: range.from, $lte: range.to };
  const ordersInRange = { createdAt: inRange };
  const notCancelled = { status: { $ne: 'Cancelled' } };

  const chartStart = startOfDay(new Date());
  chartStart.setDate(chartStart.getDate() - 29);
  const timezone = getTimezoneOffsetString();

  const [
    statusRows,
    pendingPaymentRows,
    incomeRows,
    expenseRows,
    topSellingItems,
    lowStockItems,
    lowStockCount,
    chartRows,
    chartIncomeRows,
    chartExpenseRows,
    paymentModeSplit,
    openNew,
    openPending,
  ] = await Promise.all([
    // Orders per status (+ value) in range
    Order.aggregate([
      { $match: ordersInRange },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
    ]),
    // Unpaid, not cancelled orders in range
    Order.aggregate([
      { $match: { ...ordersInRange, ...notCancelled, paymentStatus: 'Pending' } },
      { $group: { _id: null, amount: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    Income.aggregate([
      { $match: { date: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { date: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // Top 5 items by quantity sold in range
    Order.aggregate([
      { $match: { ...ordersInRange, ...notCancelled } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          name: { $last: '$items.name' },
          unit: { $last: '$items.unit' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          itemId: '$_id',
          name: 1,
          unit: 1,
          orders: 1,
          quantity: { $round: ['$quantity', 3] },
          revenue: { $round: ['$revenue', 2] },
        },
      },
    ]),
    // Items at or below their low stock limit
    Item.find({ $expr: { $lte: ['$stock', '$lowStockLimit'] } })
      .select('name category unit stock lowStockLimit isAvailable image')
      .sort({ stock: 1, name: 1 })
      .limit(20)
      .lean(),
    Item.countDocuments({ $expr: { $lte: ['$stock', '$lowStockLimit'] } }),
    // Daily sales for the last 30 days (store's local days)
    Order.aggregate([
      { $match: { createdAt: { $gte: chartStart }, ...notCancelled } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } },
          orders: { $sum: 1 },
          sales: { $sum: '$grandTotal' },
        },
      },
    ]),
    // Daily income and expense for the income vs expense chart
    dailyLedgerTotals(Income, chartStart, timezone),
    dailyLedgerTotals(Expense, chartStart, timezone),
    // How paid orders were paid
    Order.aggregate([
      { $match: { ...ordersInRange, ...notCancelled, paymentStatus: 'Paid' } },
      { $group: { _id: '$paymentMode', count: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
      { $sort: { amount: -1 } },
      { $project: { _id: 0, mode: '$_id', count: 1, amount: { $round: ['$amount', 2] } } },
    ]),
    // Orders needing attention right now (any date)
    Order.countDocuments({ status: 'New' }),
    Order.countDocuments({ status: { $in: OPEN_ORDER_STATUSES } }),
  ]);

  // Status breakdown with every status present (0 when missing)
  const statusBreakdown = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  let totalOrders = 0;
  let totalSales = 0;
  statusRows.forEach((row) => {
    statusBreakdown[row._id] = row.count;
    totalOrders += row.count;
    if (row._id !== 'Cancelled') totalSales += row.amount;
  });

  const totalIncome = round2(incomeRows[0] ? incomeRows[0].total : 0);
  const totalExpense = round2(expenseRows[0] ? expenseRows[0].total : 0);
  const last30Days = buildDailySeries(
    { orderRows: chartRows, incomeRows: chartIncomeRows, expenseRows: chartExpenseRows },
    30
  );

  res.json({
    success: true,
    data: {
      range: { type: range.type, from: range.from, to: range.to },

      totalOrders,
      newOrders: statusBreakdown.New,
      pendingOrders: OPEN_ORDER_STATUSES.reduce((sum, s) => sum + statusBreakdown[s], 0),
      deliveredOrders: statusBreakdown.Delivered,
      cancelledOrders: statusBreakdown.Cancelled,
      statusBreakdown,

      totalSales: round2(totalSales),
      totalIncome,
      totalExpense,
      profit: round2(totalIncome - totalExpense),

      pendingPaymentAmount: round2(pendingPaymentRows[0] ? pendingPaymentRows[0].amount : 0),
      pendingPaymentCount: pendingPaymentRows[0] ? pendingPaymentRows[0].count : 0,

      openOrders: { new: openNew, pending: openPending },

      topSellingItems,
      lowStockItems,
      lowStockCount,

      salesChart: { last7Days: last30Days.slice(-7), last30Days },
      paymentModeSplit,
    },
  });
});

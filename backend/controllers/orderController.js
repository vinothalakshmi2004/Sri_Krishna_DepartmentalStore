/**
 * Order management (admin): list, view, status, payment, notes, cancel, delete.
 *
 * Rules:
 *  - A Cancelled order is final - it cannot be moved to another status.
 *  - Cancelling (or deleting an undelivered order) puts the stock back, once.
 *  - Delivered + Paid automatically creates an Income entry; undoing either
 *    removes it again (see utils/orderService.syncOrderIncome).
 */
const Order = require('../models/Order');
const Income = require('../models/Income');
const Settings = require('../models/Settings');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { emitToAdmins } = require('../utils/socket');
const { ORDER_STATUSES } = require('../utils/constants');
const {
  isObjectId,
  getPagination,
  paginationMeta,
  buildSort,
} = require('../utils/helpers');
const { round2 } = require('../utils/helpers');
const {
  buildOrderFilter,
  buildOrderSummary,
  calcOrderTotals,
  restoreOrderStock,
  syncOrderIncome,
} = require('../utils/orderService');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'grandTotal', 'orderId', 'customerName', 'status', 'deliveredAt'];

/** Find by MongoDB _id or by readable order ID (ORD-0001). */
const findOrderOr404 = async (id) => {
  const filter = isObjectId(id) ? { _id: id } : { orderId: String(id).toUpperCase() };
  const order = await Order.findOne(filter);
  if (!order) throw new AppError('Order not found', 404);
  return order;
};

/** Notify connected admins that an order changed. */
const notifyUpdate = (order, change) => emitToAdmins('orderUpdated', { ...buildOrderSummary(order), change });

/** Cancel an order: restore stock, record history, drop auto income. */
const cancelOrder = async (order, reason) => {
  await restoreOrderStock(order);
  order.status = 'Cancelled';
  order.cancelledAt = new Date();
  order.deliveredAt = undefined;
  order.statusHistory.push({ status: 'Cancelled', changedAt: new Date(), note: reason || '' });
  await order.save();
  await syncOrderIncome(order);
};

/**
 * GET /api/orders
 *   ?status=New            (or several: status=New,Confirmed)
 *   &paymentStatus=Pending&paymentMode=Cash
 *   &from=2026-10-01&to=2026-10-31   (order date, inclusive)
 *   &search=ravi           (name, phone or order ID)
 *   &page=1&limit=20&sort=-createdAt
 */
exports.getOrders = asyncHandler(async (req, res) => {
  const { sort } = req.query;
  const filter = buildOrderFilter(req.query); // same filter the CSV export uses

  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const sortBy = buildSort(sort, SORT_FIELDS, { createdAt: -1, _id: -1 });

  // Counts per status for the status tabs (all other filters still apply)
  const { status: ignoredStatus, ...countFilter } = filter;

  const [orders, total, countRows] = await Promise.all([
    Order.find(filter).sort(sortBy).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $match: countFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  countRows.forEach((row) => { statusCounts[row._id] = row.count; });
  statusCounts.All = countRows.reduce((sum, row) => sum + row.count, 0);

  res.json({
    success: true,
    data: orders,
    statusCounts,
    pagination: paginationMeta(total, page, limit),
  });
});

/** GET /api/orders/:id   (:id = Mongo _id or ORD-0001) */
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOr404(req.params.id);
  const income = await Income.findOne({ source: 'Order', orderRef: order._id }).lean();
  res.json({ success: true, data: { ...order.toJSON(), incomeEntry: income || null } });
});

/** PATCH /api/orders/:id/status  { status, note? } */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;
  const order = await findOrderOr404(req.params.id);

  if (order.status === 'Cancelled') {
    throw new AppError('This order is cancelled and cannot be changed. Please place a new order instead.', 400);
  }
  if (order.status === status) {
    throw new AppError(`Order is already "${status}"`, 400);
  }

  if (status === 'Cancelled') {
    await cancelOrder(order, note);
  } else {
    order.status = status;
    order.deliveredAt = status === 'Delivered' ? new Date() : undefined;
    order.statusHistory.push({ status, changedAt: new Date(), note });
    await order.save();
    await syncOrderIncome(order);
  }

  notifyUpdate(order, 'status');
  res.json({ success: true, message: `Order status changed to ${order.status}`, data: order });
});

/**
 * PATCH /api/orders/:id/payment  { paymentStatus, paymentMode? }
 * Marking as Paid needs a real payment mode (Cash, GPay, PhonePe, UPI, Other).
 */
exports.updatePayment = asyncHandler(async (req, res) => {
  const { paymentStatus, paymentMode } = req.body;
  const order = await findOrderOr404(req.params.id);

  if (paymentStatus === 'Paid') {
    if (order.status === 'Cancelled') {
      throw new AppError('A cancelled order cannot be marked as paid', 400);
    }
    const mode = paymentMode || order.paymentMode;
    if (!mode || mode === 'None') {
      throw new AppError('Please choose a payment mode to mark the order as paid', 400, [
        { field: 'paymentMode', message: 'Payment mode is required when payment status is Paid' },
      ]);
    }
    if (order.paymentStatus !== 'Paid') order.paidAt = new Date();
    order.paymentMode = mode;
  } else {
    order.paidAt = undefined;
    order.paymentMode = paymentMode || 'None';
  }
  order.paymentStatus = paymentStatus;

  await order.save();
  await syncOrderIncome(order);

  notifyUpdate(order, 'payment');
  res.json({ success: true, message: 'Payment updated', data: order });
});

/** PATCH /api/orders/:id/note  { adminNote } */
exports.updateNote = asyncHandler(async (req, res) => {
  const order = await findOrderOr404(req.params.id);
  order.adminNote = req.body.adminNote;
  await order.save();
  res.json({ success: true, message: 'Note saved', data: order });
});

/**
 * PATCH /api/orders/:id/customer-message  { customerMessage }
 * Message shown to the customer on the Track Order page ("" removes it).
 */
exports.updateCustomerMessage = asyncHandler(async (req, res) => {
  const order = await findOrderOr404(req.params.id);
  const message = req.body.customerMessage;
  order.customerMessage = message;
  order.customerMessageAt = message ? new Date() : undefined;
  await order.save();

  notifyUpdate(order, 'message');
  res.json({ success: true, message: message ? 'Message sent to the customer' : 'Message removed', data: order });
});

/**
 * PATCH /api/orders/:id/custom-items  { amounts: [120, null, 45.5] }
 * Price the customer's own (typed-in) items. One entry per custom line, in the
 * same order; null leaves a line unpriced. Subtotal, delivery charge, grand
 * total and the automatic income entry are recalculated.
 */
exports.updateCustomItems = asyncHandler(async (req, res) => {
  const { amounts } = req.body;
  const order = await findOrderOr404(req.params.id);

  if (order.status === 'Cancelled') throw new AppError('A cancelled order cannot be changed', 400);
  if (!order.customItems.length) throw new AppError('This order has no items typed in by the customer', 400);
  if (amounts.length !== order.customItems.length) {
    throw new AppError('The order changed in the meantime. Please reload it and try again.', 409);
  }

  order.customItems.forEach((line, index) => {
    const value = amounts[index];
    line.amount = value === null || value === undefined || value === '' ? null : round2(value);
  });
  order.markModified('customItems');

  const settings = await Settings.getSingleton();
  Object.assign(order, calcOrderTotals(order.items, order.customItems, settings));
  await order.save();
  await syncOrderIncome(order);

  notifyUpdate(order, 'items');
  res.json({ success: true, message: 'Prices saved', data: order });
});

/** PATCH /api/orders/:id/cancel  { reason? } - cancels and restores stock */
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOr404(req.params.id);
  if (order.status === 'Cancelled') throw new AppError('Order is already cancelled', 400);

  await cancelOrder(order, req.body.reason);

  notifyUpdate(order, 'cancel');
  res.json({ success: true, message: 'Order cancelled and stock restored', data: order });
});

/**
 * DELETE /api/orders/:id
 * Removes the order and its auto income entry. Stock is restored unless the
 * order was Delivered (those goods really left the store) or already restored.
 */
exports.deleteOrder = asyncHandler(async (req, res) => {
  const order = await findOrderOr404(req.params.id);

  const stockRestored = order.status !== 'Delivered' ? await restoreOrderStock(order) : false;
  await Income.deleteMany({ source: 'Order', orderRef: order._id });
  await order.deleteOne();

  emitToAdmins('orderDeleted', { _id: order._id, orderId: order.orderId });
  res.json({
    success: true,
    message: stockRestored ? 'Order deleted and stock restored' : 'Order deleted',
    data: { _id: order._id, orderId: order.orderId },
  });
});

/**
 * Order business logic shared by the public and admin controllers:
 * order IDs, delivery charge, stock reservation/restoration and the
 * automatic Income entry for Delivered + Paid orders.
 */
const Counter = require('../models/Counter');
const Income = require('../models/Income');
const Item = require('../models/Item');
const Order = require('../models/Order');
const AppError = require('./AppError');
const { escapeRegex, buildDateFilter, round2 } = require('./helpers');

/**
 * MongoDB filter for the admin order list AND the orders CSV export, so an
 * export always contains exactly the orders shown on screen.
 *   status=New | New,Confirmed   paymentStatus   paymentMode
 *   from / to (order date, inclusive)   search (name, phone or order ID)
 */
const buildOrderFilter = ({ status, paymentStatus, paymentMode, from, to, search } = {}) => {
  const filter = {};
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (paymentStatus) filter.paymentStatus = String(paymentStatus);
  if (paymentMode) filter.paymentMode = String(paymentMode);

  const createdAt = buildDateFilter(from, to);
  if (createdAt) filter.createdAt = createdAt;

  if (search) {
    const regex = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ customerName: regex }, { phone: regex }, { orderId: regex }];
  }
  return filter;
};

/** 7 -> "ORD-0007" (grows naturally past 9999: "ORD-10000") */
const formatOrderId = (seq) => `ORD-${String(seq).padStart(4, '0')}`;

/** Next readable order ID from the atomic counter. */
const generateOrderId = async () => formatOrderId(await Counter.next('order'));

/** Delivery charge for a subtotal, using store settings. */
const calcDeliveryCharge = (subtotal, settings) => {
  const freeAbove = Number(settings.freeDeliveryAbove) || 0;
  if (freeAbove > 0 && subtotal >= freeAbove) return 0;
  return Number(settings.deliveryCharge) || 0;
};

/**
 * Order totals from its lines: catalogue lines + the custom ("own order") lines
 * the store has priced. Unpriced custom lines count as 0 until priced.
 */
const calcOrderTotals = (items, customItems, settings) => {
  const itemsTotal = (items || []).reduce((sum, line) => sum + line.total, 0);
  const customTotal = (customItems || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const subtotal = round2(itemsTotal + customTotal);
  const deliveryCharge = calcDeliveryCharge(subtotal, settings);
  return { subtotal, deliveryCharge, grandTotal: round2(subtotal + deliveryCharge) };
};

/** Compact order info sent over Socket.io. */
const buildOrderSummary = (order) => ({
  _id: order._id,
  orderId: order.orderId,
  customerName: order.customerName,
  phone: order.phone,
  address: order.address,
  pincode: order.pincode,
  itemCount: order.items.length + (order.customItems ? order.customItems.length : 0),
  customItemCount: order.customItems ? order.customItems.length : 0,
  subtotal: order.subtotal,
  deliveryCharge: order.deliveryCharge,
  grandTotal: order.grandTotal,
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMode: order.paymentMode,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

/**
 * Reduce stock for every order line atomically.
 * Each line only succeeds if the item is still available with enough stock.
 * If any line fails, lines already reduced are put back (manual rollback,
 * because a standalone MongoDB has no multi-document transactions).
 */
const reserveStock = async (lines) => {
  const reserved = [];
  try {
    for (const line of lines) {
      // eslint-disable-next-line no-await-in-loop
      const result = await Item.adjustStock(line.itemId, -line.quantity, {
        isAvailable: true,
        stock: { $gte: line.quantity },
      });
      if (result.modifiedCount === 0) {
        throw new AppError(`Sorry, "${line.name}" just went out of stock. Please update your cart.`, 409);
      }
      reserved.push(line);
    }
  } catch (err) {
    await releaseStock(reserved);
    throw err;
  }
  return reserved;
};

/** Put stock back for the given lines (used for rollbacks). */
const releaseStock = async (lines) => {
  await Promise.all(
    lines.map((line) =>
      Item.adjustStock(line.itemId, line.quantity).catch((err) =>
        console.error(`[stock] Failed to restore stock for ${line.itemId}: ${err.message}`)
      )
    )
  );
};

/**
 * Return an order's quantities to stock exactly once.
 * The stockRestored flag is claimed atomically first, so two simultaneous
 * cancel/delete requests can never restore the same order twice.
 * Items deleted since the order was placed are simply skipped.
 */
const restoreOrderStock = async (order) => {
  const claim = await Order.updateOne(
    { _id: order._id, stockRestored: false },
    { $set: { stockRestored: true } }
  );
  if (claim.modifiedCount === 0) return false;

  await releaseStock(order.items);
  order.stockRestored = true; // keep the in-memory document in sync
  return true;
};

/**
 * Keep the automatic Income entry in sync with an order:
 *   Delivered + Paid -> create (or update) exactly one Income entry
 *   anything else     -> remove that entry if it exists
 */
const syncOrderIncome = async (order) => {
  const filter = { source: 'Order', orderRef: order._id };

  if (order.status !== 'Delivered' || order.paymentStatus !== 'Paid') {
    await Income.deleteOne(filter);
    return null;
  }

  const update = {
    $set: {
      amount: order.grandTotal,
      paymentMode: order.paymentMode === 'None' ? 'Other' : order.paymentMode,
      note: `Auto entry for order ${order.orderId} (${order.customerName})`,
    },
    // Income date = the moment the order became Delivered + Paid
    $setOnInsert: { date: new Date() },
  };
  const options = { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: false };

  try {
    return await Income.findOneAndUpdate(filter, update, options);
  } catch (err) {
    // Two requests upserting at the same moment: the unique index stops the
    // duplicate, and the second attempt simply updates the existing entry.
    if (err.code === 11000) return Income.findOneAndUpdate(filter, update, options);
    throw err;
  }
};

module.exports = {
  buildOrderFilter,
  formatOrderId,
  generateOrderId,
  calcDeliveryCharge,
  calcOrderTotals,
  buildOrderSummary,
  reserveStock,
  releaseStock,
  restoreOrderStock,
  syncOrderIncome,
};

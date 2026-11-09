/**
 * CSV report exports (admin). Every report accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD.
 *
 * The file is sent as a download (Content-Disposition: attachment). From the
 * frontend, request it with the Authorization header and responseType "blob".
 */
const { Parser } = require('@json2csv/plainjs');
const Order = require('../models/Order');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const asyncHandler = require('../utils/asyncHandler');
const { buildOrderFilter } = require('../utils/orderService');
const { buildDateFilter, formatDisplayDateTime, toDateKey, parseDate, round2 } = require('../utils/helpers');

/**
 * Prevent "CSV injection": a cell starting with = + - @ could run as a
 * formula when the file is opened in Excel. Customer-typed text is prefixed
 * with an apostrophe so it is shown as plain text.
 */
const safeText = (value) => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
};

const STATUS_LABELS = { OutForDelivery: 'Out for Delivery' };
const statusLabel = (status) => STATUS_LABELS[status] || status;

/** "orders_Delivered_2026-10-01_to_2026-10-20.csv" */
const buildFileName = (type, from, to, extra = '') => {
  const fromKey = parseDate(from) ? toDateKey(parseDate(from)) : 'start';
  const toKey = parseDate(to) ? toDateKey(parseDate(to)) : toDateKey(new Date());
  const tag = extra ? `_${String(extra).replace(/[^A-Za-z0-9_-]+/g, '-')}` : '';
  return `${type}${tag}_${fromKey}_to_${toKey}.csv`;
};

/** Convert rows to CSV (with BOM so Excel reads UTF-8 correctly) and send it. */
const sendCsv = (res, fileName, fields, rows) => {
  const csv = new Parser({ fields, withBOM: true }).parse(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(csv);
};

/** Money saved through offers on one order line */
const lineSavings = (line) => (line.originalPrice > line.price ? round2((line.originalPrice - line.price) * line.quantity) : 0);

/** Catalogue lines + lines the customer typed in ("own order") */
const lineCount = (order) => order.items.length + (order.customItems ? order.customItems.length : 0);
const sum = (list, pick) => round2(list.reduce((total, x) => total + (Number(pick(x)) || 0), 0));

/**
 * GET /api/reports/orders
 *   ?from=&to=&status=New,Confirmed&paymentStatus=&paymentMode=&search=
 *   &format=summary (one row per order, default) | items (one row per item)
 * Uses the same filters as the admin order list. A TOTAL row is added at the end.
 */
exports.exportOrders = asyncHandler(async (req, res) => {
  const { from, to, status, format } = req.query;
  const orders = await Order.find(buildOrderFilter(req.query)).sort({ createdAt: 1 }).lean();
  const tag = [format === 'items' ? 'items' : '', status ? String(status).split(',').join('-') : ''].filter(Boolean).join('_');
  const fileName = buildFileName('orders', from, to, tag);

  const nonCancelled = orders.filter((o) => o.status !== 'Cancelled');
  const hasMixed = nonCancelled.length > 0 && nonCancelled.length < orders.length;

  if (format === 'items') {
    // One row per item line. Order totals appear only on the first line of each
    // order, so adding up a column in Excel never double counts.
    const rows = [];
    orders.forEach((o) => {
      // Catalogue lines first, then the lines the customer typed in ("own order")
      const ownLines = (o.customItems || []).map((line) => ({
        name: `${line.name} (own item)`,
        quantity: line.quantity || '',
        unit: '',
        price: '',
        originalPrice: '',
        total: line.amount === null || line.amount === undefined ? 'Not priced' : line.amount,
        own: true,
      }));
      [...o.items, ...ownLines].forEach((line, index) => {
        const first = index === 0;
        rows.push({
          orderId: o.orderId,
          date: formatDisplayDateTime(o.createdAt),
          customerName: safeText(o.customerName),
          phone: o.phone,
          status: statusLabel(o.status),
          paymentStatus: o.paymentStatus,
          paymentMode: o.paymentMode === 'None' ? '' : o.paymentMode,
          item: safeText(line.name),
          quantity: line.quantity,
          unit: line.unit,
          price: line.price,
          regularPrice: line.own ? '' : line.originalPrice || line.price,
          savings: line.own ? '' : lineSavings(line),
          lineTotal: line.total,
          orderSubtotal: first ? o.subtotal : '',
          deliveryCharge: first ? o.deliveryCharge : '',
          orderTotal: first ? o.grandTotal : '',
        });
      });
    });

    const totalRow = (label, list) => ({
      orderId: label,
      item: `${list.length} orders, ${list.reduce((n, o) => n + lineCount(o), 0)} item lines`,
      savings: sum(list, (o) => o.items.reduce((s, l) => s + lineSavings(l), 0)),
      lineTotal: sum(list, (o) => o.subtotal),
      orderSubtotal: sum(list, (o) => o.subtotal),
      deliveryCharge: sum(list, (o) => o.deliveryCharge),
      orderTotal: sum(list, (o) => o.grandTotal),
    });
    if (orders.length) {
      rows.push({});
      rows.push(totalRow('TOTAL', orders));
      if (hasMixed) rows.push(totalRow('TOTAL (without cancelled)', nonCancelled));
    }

    return sendCsv(res, fileName, [
      { label: 'Order ID', value: 'orderId' },
      { label: 'Order Date', value: 'date' },
      { label: 'Customer Name', value: 'customerName' },
      { label: 'Phone', value: 'phone' },
      { label: 'Status', value: 'status' },
      { label: 'Payment Status', value: 'paymentStatus' },
      { label: 'Payment Mode', value: 'paymentMode' },
      { label: 'Item', value: 'item' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Unit', value: 'unit' },
      { label: 'Price (Rs)', value: 'price' },
      { label: 'Regular Price (Rs)', value: 'regularPrice' },
      { label: 'Offer Savings (Rs)', value: 'savings' },
      { label: 'Line Total (Rs)', value: 'lineTotal' },
      { label: 'Order Subtotal (Rs)', value: 'orderSubtotal' },
      { label: 'Delivery Charge (Rs)', value: 'deliveryCharge' },
      { label: 'Order Total (Rs)', value: 'orderTotal' },
    ], rows);
  }

  // Summary: one row per order
  const rows = orders.map((o) => ({
    orderId: o.orderId,
    date: formatDisplayDateTime(o.createdAt),
    customerName: safeText(o.customerName),
    phone: o.phone,
    address: safeText(o.address),
    landmark: safeText(o.landmark),
    pincode: o.pincode,
    items: safeText([
      ...o.items.map((i) => `${i.name} x ${i.quantity} ${i.unit} @ ${i.price} = ${i.total}`),
      ...(o.customItems || []).map((i) => `${i.name}${i.quantity ? ` x ${i.quantity}` : ''} (own item) = ${i.amount === null || i.amount === undefined ? 'not priced' : i.amount}`),
    ].join('; ')),
    itemCount: lineCount(o),
    subtotal: o.subtotal,
    savings: round2(o.items.reduce((s, l) => s + lineSavings(l), 0)),
    deliveryCharge: o.deliveryCharge,
    grandTotal: o.grandTotal,
    status: statusLabel(o.status),
    paymentStatus: o.paymentStatus,
    paymentMode: o.paymentMode === 'None' ? '' : o.paymentMode,
    paidAt: formatDisplayDateTime(o.paidAt),
    deliveredAt: formatDisplayDateTime(o.deliveredAt),
    cancelledAt: formatDisplayDateTime(o.cancelledAt),
    customerNote: safeText(o.note),
    customerMessage: safeText(o.customerMessage),
    adminNote: safeText(o.adminNote),
  }));

  const totalRow = (label, list) => ({
    orderId: label,
    items: `${list.length} orders`,
    itemCount: list.reduce((n, o) => n + lineCount(o), 0),
    subtotal: sum(list, (o) => o.subtotal),
    savings: sum(list, (o) => o.items.reduce((s, l) => s + lineSavings(l), 0)),
    deliveryCharge: sum(list, (o) => o.deliveryCharge),
    grandTotal: sum(list, (o) => o.grandTotal),
  });
  if (orders.length) {
    rows.push({});
    rows.push(totalRow('TOTAL', orders));
    if (hasMixed) rows.push(totalRow('TOTAL (without cancelled)', nonCancelled));
  }

  return sendCsv(res, fileName, [
    { label: 'Order ID', value: 'orderId' },
    { label: 'Order Date', value: 'date' },
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Phone', value: 'phone' },
    { label: 'Address', value: 'address' },
    { label: 'Landmark', value: 'landmark' },
    { label: 'Pincode', value: 'pincode' },
    { label: 'Items', value: 'items' },
    { label: 'Item Count', value: 'itemCount' },
    { label: 'Subtotal (Rs)', value: 'subtotal' },
    { label: 'Offer Savings (Rs)', value: 'savings' },
    { label: 'Delivery Charge (Rs)', value: 'deliveryCharge' },
    { label: 'Grand Total (Rs)', value: 'grandTotal' },
    { label: 'Status', value: 'status' },
    { label: 'Payment Status', value: 'paymentStatus' },
    { label: 'Payment Mode', value: 'paymentMode' },
    { label: 'Paid At', value: 'paidAt' },
    { label: 'Delivered At', value: 'deliveredAt' },
    { label: 'Cancelled At', value: 'cancelledAt' },
    { label: 'Customer Note', value: 'customerNote' },
    { label: 'Message to Customer', value: 'customerMessage' },
    { label: 'Admin Note (private)', value: 'adminNote' },
  ], rows);
});

/** GET /api/reports/income?from=&to=&source= */
exports.exportIncome = asyncHandler(async (req, res) => {
  const { from, to, source } = req.query;
  const filter = {};
  const date = buildDateFilter(from, to);
  if (date) filter.date = date;
  if (source) filter.source = String(source);

  const incomes = await Income.find(filter).populate('orderRef', 'orderId customerName').sort({ date: 1 }).lean();

  const rows = incomes.map((i) => ({
    date: formatDisplayDateTime(i.date),
    source: i.source,
    orderId: i.orderRef ? i.orderRef.orderId : '',
    customerName: i.orderRef ? safeText(i.orderRef.customerName) : '',
    amount: i.amount,
    paymentMode: i.paymentMode,
    note: safeText(i.note),
  }));
  if (incomes.length) {
    rows.push({});
    rows.push({ date: 'TOTAL', source: `${incomes.length} entries`, amount: sum(incomes, (i) => i.amount) });
  }

  const fields = [
    { label: 'Date', value: 'date' },
    { label: 'Source', value: 'source' },
    { label: 'Order ID', value: 'orderId' },
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Amount (Rs)', value: 'amount' },
    { label: 'Payment Mode', value: 'paymentMode' },
    { label: 'Note', value: 'note' },
  ];

  sendCsv(res, buildFileName('income', from, to), fields, rows);
});

/** GET /api/reports/expenses?from=&to=&category= */
exports.exportExpenses = asyncHandler(async (req, res) => {
  const { from, to, category } = req.query;
  const filter = {};
  const date = buildDateFilter(from, to);
  if (date) filter.date = date;
  if (category) filter.category = String(category);

  const expenses = await Expense.find(filter).sort({ date: 1 }).lean();

  const rows = expenses.map((e) => ({
    date: formatDisplayDateTime(e.date),
    title: safeText(e.title),
    category: e.category,
    amount: e.amount,
    paymentMode: e.paymentMode,
    note: safeText(e.note),
  }));
  if (expenses.length) {
    rows.push({});
    rows.push({ date: 'TOTAL', title: `${expenses.length} expenses`, amount: sum(expenses, (e) => e.amount) });
  }

  const fields = [
    { label: 'Date', value: 'date' },
    { label: 'Title', value: 'title' },
    { label: 'Category', value: 'category' },
    { label: 'Amount (Rs)', value: 'amount' },
    { label: 'Payment Mode', value: 'paymentMode' },
    { label: 'Note', value: 'note' },
  ];

  sendCsv(res, buildFileName('expenses', from, to), fields, rows);
});

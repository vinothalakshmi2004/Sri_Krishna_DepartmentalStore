/**
 * Customers (admin) - there are no customer accounts, so customers are
 * built by grouping orders by phone number.
 */
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const {
  escapeRegex,
  round2,
  getPagination,
  paginationMeta,
  buildSort,
} = require('../utils/helpers');

const SORT_FIELDS = ['lastOrderDate', 'totalSpent', 'totalOrders', 'name', 'firstOrderDate'];

// Group all orders of one phone number into a customer record
const CUSTOMER_GROUP_STAGES = [
  { $sort: { createdAt: -1 } }, // so $first = latest order
  {
    $group: {
      _id: '$phone',
      name: { $first: '$customerName' },
      lastAddress: { $first: '$address' },
      lastLandmark: { $first: '$landmark' },
      lastPincode: { $first: '$pincode' },
      totalOrders: { $sum: 1 },
      deliveredOrders: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] } },
      cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
      // Cancelled orders do not count as money spent
      totalSpent: { $sum: { $cond: [{ $ne: ['$status', 'Cancelled'] }, '$grandTotal', 0] } },
      lastOrderDate: { $first: '$createdAt' },
      firstOrderDate: { $last: '$createdAt' },
    },
  },
  {
    $project: {
      _id: 0,
      phone: '$_id',
      name: 1,
      lastAddress: 1,
      lastLandmark: 1,
      lastPincode: 1,
      totalOrders: 1,
      deliveredOrders: 1,
      cancelledOrders: 1,
      totalSpent: { $round: ['$totalSpent', 2] },
      lastOrderDate: 1,
      firstOrderDate: 1,
    },
  },
];

/** GET /api/customers?search=&page=&limit=&sort=-lastOrderDate|-totalSpent|-totalOrders|name */
exports.getCustomers = asyncHandler(async (req, res) => {
  const { search, sort } = req.query;
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const sortBy = buildSort(sort, SORT_FIELDS, { lastOrderDate: -1, phone: 1 }, 'phone');

  const pipeline = [...CUSTOMER_GROUP_STAGES];
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    pipeline.push({ $match: { $or: [{ name: regex }, { phone: regex }] } });
  }
  pipeline.push({
    $facet: {
      data: [{ $sort: sortBy }, { $skip: skip }, { $limit: limit }],
      total: [{ $count: 'count' }],
    },
  });

  const [result] = await Order.aggregate(pipeline).allowDiskUse(true);
  const total = result.total[0] ? result.total[0].count : 0;

  res.json({ success: true, data: result.data, pagination: paginationMeta(total, page, limit) });
});

/** GET /api/customers/:phone - one customer's summary and order history */
exports.getCustomer = asyncHandler(async (req, res) => {
  const { phone } = req.params;
  const orders = await Order.find({ phone })
    .select('orderId customerName address landmark pincode items customItems grandTotal status paymentStatus paymentMode createdAt deliveredAt')
    .sort({ createdAt: -1 })
    .lean();

  if (!orders.length) throw new AppError('Customer not found', 404);

  const notCancelled = orders.filter((o) => o.status !== 'Cancelled');
  const latest = orders[0];

  res.json({
    success: true,
    data: {
      phone,
      name: latest.customerName,
      lastAddress: latest.address,
      lastLandmark: latest.landmark,
      lastPincode: latest.pincode,
      totalOrders: orders.length,
      deliveredOrders: orders.filter((o) => o.status === 'Delivered').length,
      cancelledOrders: orders.length - notCancelled.length,
      totalSpent: round2(notCancelled.reduce((sum, o) => sum + o.grandTotal, 0)),
      lastOrderDate: latest.createdAt,
      firstOrderDate: orders[orders.length - 1].createdAt,
      orders,
    },
  });
});

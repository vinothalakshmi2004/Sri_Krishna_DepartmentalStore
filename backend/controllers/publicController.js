/**
 * Public endpoints used by the customer landing page (no login).
 */
const Item = require('../models/Item');
const Order = require('../models/Order');
const Offer = require('../models/Offer');
const Settings = require('../models/Settings');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { emitToAdmins } = require('../utils/socket');
const { escapeRegex, round2, round3 } = require('../utils/helpers');
const { FRACTIONAL_UNITS } = require('../utils/constants');
const {
  generateOrderId,
  calcDeliveryCharge,
  buildOrderSummary,
  reserveStock,
  releaseStock,
} = require('../utils/orderService');
const {
  liveOfferFilter,
  getLiveOfferPrices,
  priceWithOffer,
  discountPercent,
} = require('../utils/offerService');

/** Offers can be switched off for the whole website (Admin -> Offers) */
const offersAreOn = (settings) => settings.offersEnabled !== false;

/** Live offer prices, or none at all while offers are switched off */
const offerPricesFor = async (settings, itemIds) => (offersAreOn(settings) ? getLiveOfferPrices(itemIds) : new Map());

/**
 * GET /api/public/settings
 * Store information for the landing page (name, contact, gallery, delivery rules ...).
 */
exports.getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ success: true, data: settings });
});

/**
 * GET /api/public/items?category=&search=&inStock=true
 * Only items marked available. Out-of-stock items are still listed (with
 * inStock: false) unless ?inStock=true is given.
 * Items with a live offer get the offer price in `price`, plus
 * `originalPrice` and `offerTitle`.
 */
exports.getPublicItems = asyncHandler(async (req, res) => {
  const { category, search, inStock } = req.query;
  const filter = { isAvailable: true };

  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { description: regex }, { category: regex }];
  }
  if (inStock === 'true') filter.stock = { $gt: 0 };

  const items = await Item.find(filter)
    .select('name description price unit category image stock isAvailable')
    .sort({ category: 1, name: 1 })
    .limit(1000)
    .lean();

  const offerPrices = await offerPricesFor(await Settings.getSingleton(), items.map((item) => item._id));
  const data = items.map((item) => ({ ...item, ...priceWithOffer(item, offerPrices), inStock: item.stock > 0 }));
  res.json({ success: true, count: data.length, data });
});

/**
 * GET /api/public/offers
 * Live offers for the landing page "Offer Zone" (newest first).
 * Item offers include the item with its current offer price, so the card can
 * add it straight to the cart. Offers for hidden / deleted items are skipped.
 */
exports.getPublicOffers = asyncHandler(async (req, res) => {
  if (!offersAreOn(await Settings.getSingleton())) {
    res.json({ success: true, count: 0, data: [] });
    return;
  }
  const offers = await Offer.find(liveOfferFilter())
    .populate('item', 'name description price unit image category stock isAvailable')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const visible = offers.filter((o) => o.type !== 'item' || (o.item && o.item.isAvailable));
  const offerPrices = await getLiveOfferPrices(visible.filter((o) => o.item).map((o) => o.item._id));

  const data = visible.map((offer) => {
    const base = {
      _id: offer._id,
      type: offer.type,
      title: offer.title,
      description: offer.description,
      badge: offer.badge,
      image: offer.image || (offer.item && offer.item.image) || '',
      startDate: offer.startDate,
      endDate: offer.endDate,
    };
    if (offer.type !== 'item') return base;

    const { item } = offer;
    const pricing = priceWithOffer(item, offerPrices);
    return {
      ...base,
      discountPercent: discountPercent(pricing.price, item.price),
      item: {
        _id: item._id,
        name: item.name,
        description: item.description,
        unit: item.unit,
        category: item.category,
        image: item.image,
        stock: item.stock,
        inStock: item.stock > 0,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
      },
    };
  });

  res.json({ success: true, count: data.length, data });
});

/**
 * GET /api/public/categories
 * Categories that have at least one available item, sorted A-Z.
 */
exports.getPublicCategories = asyncHandler(async (req, res) => {
  const categories = await Item.distinct('category', { isAvailable: true });
  categories.sort((a, b) => a.localeCompare(b));
  res.json({ success: true, data: categories });
});

/**
 * POST /api/public/orders
 * Place an order. Prices are ALWAYS taken from the database - any price sent
 * by the client is ignored.
 *
 * Checks, in order: store open -> pincode allowed -> each item exists, is
 * available, has a valid quantity and enough stock -> minimum order amount.
 * Then stock is reduced atomically, the order saved and admins notified.
 *
 * `customItems` ("Your own order") are lines the customer typed in: only the
 * name and quantity text are kept, no stock is reserved and the store adds the
 * price later. Orders with such lines skip the minimum order check, because
 * their real value is only known once the store prices them.
 */
exports.placeOrder = asyncHandler(async (req, res) => {
  const { customerName, phone, address, pincode } = req.body;
  const cart = Array.isArray(req.body.items) ? req.body.items : [];
  const customItems = (Array.isArray(req.body.customItems) ? req.body.customItems : [])
    .map(({ name, quantity }) => ({ name, quantity: quantity || '', amount: null })) // any price sent by the client is ignored
    .filter((line) => line.name);
  const landmark = req.body.landmark || '';
  const note = req.body.note || '';
  const settings = await Settings.getSingleton();

  // 1. Store open?
  if (!settings.isStoreOpen) {
    throw new AppError('Sorry, the store is closed right now and is not accepting orders.', 403);
  }

  // 2. Do we deliver to this pincode? (empty list = everywhere)
  if (settings.allowedPincodes.length && !settings.allowedPincodes.includes(pincode)) {
    throw new AppError(`Sorry, we do not deliver to pincode ${pincode} yet.`, 400);
  }

  // 3. Merge duplicate cart lines (same item added twice)
  const quantities = new Map();
  cart.forEach(({ itemId, quantity }) => {
    const id = String(itemId);
    quantities.set(id, round3((quantities.get(id) || 0) + Number(quantity)));
  });

  // 4. Validate every item against the database and build price snapshots
  //    (live offers lower the price - the same price the customer saw)
  const dbItems = await Item.find({ _id: { $in: [...quantities.keys()] } });
  const itemsById = new Map(dbItems.map((item) => [item._id.toString(), item]));
  const offerPrices = await offerPricesFor(settings, dbItems.map((item) => item._id));

  const lines = [];
  const problems = [];
  quantities.forEach((quantity, id) => {
    const item = itemsById.get(id);
    if (!item) {
      problems.push({ itemId: id, message: 'An item in your cart is no longer sold. Please remove it.' });
      return;
    }
    if (!item.isAvailable) {
      problems.push({ itemId: id, name: item.name, message: `"${item.name}" is currently unavailable.` });
      return;
    }
    if (!FRACTIONAL_UNITS.includes(item.unit) && !Number.isInteger(quantity)) {
      problems.push({ itemId: id, name: item.name, message: `"${item.name}" can only be ordered in whole numbers.` });
      return;
    }
    if (item.stock < quantity) {
      problems.push({
        itemId: id,
        name: item.name,
        availableStock: item.stock,
        message: item.stock > 0
          ? `Only ${item.stock} ${item.unit} of "${item.name}" is left in stock.`
          : `"${item.name}" is out of stock.`,
      });
      return;
    }
    const { price, originalPrice } = priceWithOffer(item, offerPrices);
    lines.push({
      itemId: item._id,
      name: item.name,
      price,
      ...(originalPrice ? { originalPrice } : {}),
      unit: item.unit,
      quantity,
      total: round2(price * quantity),
    });
  });

  if (problems.length) {
    throw new AppError(problems[0].message, 400, problems.map((p) => ({ field: 'items', ...p })));
  }

  // 5. Totals (server side only)
  const subtotal = round2(lines.reduce((sum, line) => sum + line.total, 0));
  if (!customItems.length && subtotal < settings.minOrderAmount) {
    const shortBy = round2(settings.minOrderAmount - subtotal);
    throw new AppError(
      `Home delivery is available for orders of ₹${settings.minOrderAmount} and above. Please add items worth ₹${shortBy} more.`,
      400
    );
  }
  const deliveryCharge = calcDeliveryCharge(subtotal, settings);
  const grandTotal = round2(subtotal + deliveryCharge);

  // 6. Reserve stock atomically, then save the order (rollback stock on failure)
  await reserveStock(lines);
  let order;
  try {
    order = await Order.create({
      orderId: await generateOrderId(),
      customerName,
      phone,
      address,
      landmark,
      pincode,
      note,
      items: lines,
      customItems,
      subtotal,
      deliveryCharge,
      grandTotal,
      statusHistory: [{ status: 'New', changedAt: new Date(), note: 'Order placed by customer' }],
    });
  } catch (err) {
    await releaseStock(lines);
    throw err;
  }

  // 7. Real-time notifications for the admin panel
  emitToAdmins('newOrder', buildOrderSummary(order));
  try {
    const lowStock = await Item.find({
      _id: { $in: lines.map((line) => line.itemId) },
      $expr: { $lte: ['$stock', '$lowStockLimit'] },
    }).select('name stock unit lowStockLimit').lean();
    if (lowStock.length) emitToAdmins('lowStock', lowStock);
  } catch (err) {
    console.error(`[socket] low stock check failed: ${err.message}`);
  }

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: {
      orderId: order.orderId,
      status: order.status,
      items: order.items,
      customItems: order.customItems,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt,
    },
  });
});

/**
 * GET /api/public/orders/track/:orderId?phone=9876543210
 * The customer's view of an order: the status set by the admin, the
 * comments added with each status change, and the store's message.
 * The phone number must match the order, otherwise "not found" is returned
 * (so nobody can look up someone else's order). The private admin note is
 * never included.
 */
exports.trackOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { phone } = req.query;

  const order = await Order.findOne({ orderId, phone }).lean();
  if (!order) {
    throw new AppError('Order not found. Please check the order ID and the phone number used for the order.', 404);
  }

  res.json({
    success: true,
    data: {
      orderId: order.orderId,
      customerName: order.customerName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMode: order.paymentStatus === 'Paid' ? order.paymentMode : null,
      items: order.items.map(({ name, price, originalPrice, unit, quantity, total }) => ({ name, price, originalPrice, unit, quantity, total })),
      customItems: (order.customItems || []).map(({ name, quantity, amount }) => ({ name, quantity, amount })),
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      grandTotal: order.grandTotal,
      statusHistory: (order.statusHistory || []).map(({ status, changedAt, note }) => ({ status, changedAt, note: note || '' })),
      customerMessage: order.customerMessage || '',
      customerMessageAt: order.customerMessageAt || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deliveredAt: order.deliveredAt || null,
      cancelledAt: order.cancelledAt || null,
    },
  });
});

/**
 * Offer management (admin): post daily offers shown in the landing page
 * "Offer Zone". Item offers change the price customers pay while live.
 */
const Offer = require('../models/Offer');
const Item = require('../models/Item');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicPath, removeUpload } = require('../utils/fileHelpers');
const { escapeRegex, round2, startOfDay, endOfDay } = require('../utils/helpers');
const { STATUS_FILTERS, getOfferStatus, discountPercent } = require('../utils/offerService');

const ITEM_FIELDS = 'name price unit image category stock isAvailable';

const findOfferOr404 = async (id) => {
  const offer = await Offer.findById(id).populate('item', ITEM_FIELDS);
  if (!offer) throw new AppError('Offer not found', 404);
  return offer;
};

/** Offer document -> JSON with status and discount info for the admin UI */
const present = (offer, now = new Date()) => {
  const data = typeof offer.toJSON === 'function' ? offer.toJSON() : offer;
  const item = data.item && typeof data.item === 'object' ? data.item : null;
  return {
    ...data,
    status: getOfferStatus(data, now),
    discountPercent: item && data.offerPrice ? discountPercent(data.offerPrice, item.price) : 0,
  };
};

const fieldError = (field, message, status = 400) => new AppError(message, status, [{ field, message }]);

/**
 * Turn the validated request body into offer fields, applying defaults and
 * business rules. `existing` is the current offer when updating.
 */
const buildOfferData = async (body, existing) => {
  const data = {};
  const type = body.type || (existing && existing.type) || 'general';
  data.type = type;

  ['title', 'description', 'badge'].forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.startDate) data.startDate = startOfDay(body.startDate);
  if (body.endDate !== undefined) data.endDate = body.endDate ? endOfDay(body.endDate) : null;

  const current = (field) => (data[field] !== undefined ? data[field] : existing ? existing[field] : undefined);

  if (type === 'item') {
    const existingItemId = existing && existing.item ? String(existing.item._id || existing.item) : null;
    const itemId = body.item || existingItemId;
    if (!itemId) throw fieldError('item', 'Choose the item for this offer');

    const item = await Item.findById(itemId);
    if (!item) throw fieldError('item', 'The chosen item no longer exists', 404);

    const offerPrice = body.offerPrice !== undefined ? body.offerPrice : existing && existing.offerPrice;
    if (!(offerPrice > 0)) throw fieldError('offerPrice', 'Enter the offer price');
    if (offerPrice >= item.price) {
      throw fieldError('offerPrice', `Offer price must be lower than the current price of ₹${item.price}`);
    }

    data.item = item._id;
    data.offerPrice = round2(offerPrice);
    // Friendly defaults when left empty
    if (!current('title')) data.title = `${item.name} at just ₹${data.offerPrice}`;
    if (!current('badge')) data.badge = `${discountPercent(data.offerPrice, item.price)}% OFF`;
  } else {
    data.item = null;
    data.offerPrice = null;
    if (!current('title')) throw fieldError('title', 'Offer title is required');
  }

  // New offers start today unless a date was given
  if (!existing && !data.startDate) data.startDate = startOfDay(new Date());
  const start = current('startDate');
  const end = current('endDate');
  if (start && end && end < start) throw fieldError('endDate', 'End date must be on or after the start date');

  return data;
};

/**
 * GET /api/offers?status=active|scheduled|paused|expired&search=
 * Returns offers (newest first) and counts for the status tabs.
 */
exports.getOffers = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const now = new Date();

  const filter = status && STATUS_FILTERS[status] ? STATUS_FILTERS[status](now) : {};
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$and = [{ $or: [{ title: regex }, { description: regex }, { badge: regex }] }];
  }

  const [offers, ...counts] = await Promise.all([
    Offer.find(filter).populate('item', ITEM_FIELDS).sort({ createdAt: -1 }).limit(200),
    Offer.countDocuments({}),
    ...Object.values(STATUS_FILTERS).map((build) => Offer.countDocuments(build(now))),
  ]);

  const statusCounts = { all: counts[0] };
  Object.keys(STATUS_FILTERS).forEach((key, index) => {
    statusCounts[key] = counts[index + 1];
  });

  res.json({ success: true, data: offers.map((o) => present(o, now)), statusCounts });
});

/** GET /api/offers/:id */
exports.getOffer = asyncHandler(async (req, res) => {
  res.json({ success: true, data: present(await findOfferOr404(req.params.id)) });
});

/** POST /api/offers  (multipart/form-data, optional "image" file) */
exports.createOffer = asyncHandler(async (req, res) => {
  const data = await buildOfferData(req.body, null);
  if (req.file) data.image = toPublicPath(req.file);

  const offer = await Offer.create(data);
  await offer.populate('item', ITEM_FIELDS);
  res.status(201).json({ success: true, message: 'Offer published', data: present(offer) });
});

/** PUT /api/offers/:id  (multipart/form-data; removeImage=true clears the photo) */
exports.updateOffer = asyncHandler(async (req, res) => {
  const offer = await findOfferOr404(req.params.id);
  const data = await buildOfferData(req.body, offer);
  const oldImage = offer.image;

  offer.set(data);
  if (req.file) offer.image = toPublicPath(req.file);
  else if (req.body.removeImage) offer.image = '';
  await offer.save();
  await offer.populate('item', ITEM_FIELDS);

  if (oldImage && oldImage !== offer.image) await removeUpload(oldImage);
  res.json({ success: true, message: 'Offer updated', data: present(offer) });
});

/** PATCH /api/offers/:id/toggle  { isActive? }  (flips when no body) */
exports.toggleOffer = asyncHandler(async (req, res) => {
  const offer = await findOfferOr404(req.params.id);
  offer.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : !offer.isActive;
  await offer.save();
  res.json({
    success: true,
    message: offer.isActive ? 'Offer is live again' : 'Offer paused - hidden from customers',
    data: present(offer),
  });
});

/** PATCH /api/offers/:id/repeat-today - run the same offer again for today only */
exports.repeatToday = asyncHandler(async (req, res) => {
  const offer = await findOfferOr404(req.params.id);
  if (offer.type === 'item' && offer.item && offer.offerPrice >= offer.item.price) {
    throw new AppError(`The item now costs ₹${offer.item.price}, which is not more than the offer price. Edit the offer price first.`, 400);
  }
  if (offer.type === 'item' && !offer.item) throw new AppError('The item of this offer was deleted. Edit the offer first.', 400);

  offer.startDate = startOfDay(new Date());
  offer.endDate = endOfDay(new Date());
  offer.isActive = true;
  await offer.save();
  res.json({ success: true, message: 'Offer is live for today', data: present(offer) });
});

/** DELETE /api/offers/:id */
exports.deleteOffer = asyncHandler(async (req, res) => {
  const offer = await findOfferOr404(req.params.id);
  await offer.deleteOne();
  await removeUpload(offer.image);
  res.json({ success: true, message: 'Offer deleted', data: { _id: offer._id } });
});

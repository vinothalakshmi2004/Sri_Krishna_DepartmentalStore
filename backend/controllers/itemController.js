/**
 * Item management (admin): CRUD, image upload, availability and stock.
 */
const { matchedData } = require('express-validator');
const Item = require('../models/Item');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicPath, removeUpload } = require('../utils/fileHelpers');
const { lookupBarcode } = require('../utils/barcodeLookup');
const {
  escapeRegex,
  round3,
  getPagination,
  paginationMeta,
  buildSort,
} = require('../utils/helpers');

const SORT_FIELDS = ['name', 'price', 'stock', 'category', 'createdAt', 'updatedAt'];

const findItemOr404 = async (id) => {
  const item = await Item.findById(id);
  if (!item) throw new AppError('Item not found', 404);
  return item;
};

/** Each barcode may belong to one item only */
const assertBarcodeFree = async (barcode, itemId) => {
  const other = await Item.findOne({ barcode, _id: { $ne: itemId } }).select('name');
  if (other) throw new AppError(`Barcode ${barcode} is already used by "${other.name}"`, 409);
};

/**
 * GET /api/items?search=&category=&isAvailable=true|false&lowStock=true&page=&limit=&sort=
 */
exports.getItems = asyncHandler(async (req, res) => {
  const { search, category, isAvailable, lowStock, sort } = req.query;
  const filter = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { description: regex }, { category: regex }, { barcode: regex }];
  }
  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  if (isAvailable === 'true' || isAvailable === 'false') filter.isAvailable = isAvailable === 'true';
  if (lowStock === 'true') filter.$expr = { $lte: ['$stock', '$lowStockLimit'] };

  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50, maxLimit: 500 });
  const sortBy = buildSort(sort, SORT_FIELDS, { createdAt: -1, _id: -1 });

  const [items, total] = await Promise.all([
    Item.find(filter).sort(sortBy).skip(skip).limit(limit),
    Item.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, pagination: paginationMeta(total, page, limit) });
});

/** GET /api/items/categories - every category in use (A-Z) */
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await Item.distinct('category');
  categories.sort((a, b) => a.localeCompare(b));
  res.json({ success: true, data: categories });
});

/**
 * GET /api/items/barcode/:code
 * The store item with this barcode, otherwise product details found online
 * (name, brand, size, category, photo) to pre-fill the "Add item" form.
 */
exports.lookupBarcode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const item = await Item.findOne({ barcode: code });
  if (item) {
    return res.json({
      success: true,
      message: `"${item.name}" already has this barcode`,
      data: { barcode: code, item, product: null, unreachable: false, online: false },
    });
  }

  const categories = await Item.distinct('category');
  const result = await lookupBarcode(code, categories);
  let message = 'No product details found for this barcode';
  if (result.product) message = `Details found on ${result.product.source}`;
  else if (result.unreachable) message = 'Could not reach the online product databases';

  res.json({ success: true, message, data: { barcode: code, item: null, ...result } });
});

/** GET /api/items/:id */
exports.getItem = asyncHandler(async (req, res) => {
  const item = await findItemOr404(req.params.id);
  res.json({ success: true, data: item });
});

/** POST /api/items  (multipart/form-data, optional file field "image") */
exports.createItem = asyncHandler(async (req, res) => {
  const data = matchedData(req, { locations: ['body'] });
  delete data.removeImage;
  if (data.stock !== undefined) data.stock = round3(data.stock);
  if (req.file) data.image = toPublicPath(req.file);
  if (data.barcode) await assertBarcodeFree(data.barcode);
  else delete data.barcode;

  const item = await Item.create(data);
  res.status(201).json({ success: true, message: 'Item created', data: item });
});

/**
 * PUT /api/items/:id  (multipart/form-data)
 * Send a new "image" file to replace the picture, or removeImage=true to clear it.
 */
exports.updateItem = asyncHandler(async (req, res) => {
  const item = await findItemOr404(req.params.id);
  const data = matchedData(req, { locations: ['body'] });
  const { removeImage } = data;
  delete data.removeImage;
  if (data.stock !== undefined) data.stock = round3(data.stock);
  if (data.barcode) await assertBarcodeFree(data.barcode, item._id);
  else if (data.barcode === '') data.barcode = undefined; // cleared by the admin

  const oldImage = item.image;
  item.set(data);
  if (req.file) item.image = toPublicPath(req.file);
  else if (removeImage) item.image = '';

  await item.save();

  // Delete the previous image file only after the update succeeded
  if (oldImage && oldImage !== item.image) await removeUpload(oldImage);

  res.json({ success: true, message: 'Item updated', data: item });
});

/** DELETE /api/items/:id  (past orders keep their own item snapshot) */
exports.deleteItem = asyncHandler(async (req, res) => {
  const item = await findItemOr404(req.params.id);
  await item.deleteOne();
  await removeUpload(item.image);
  res.json({ success: true, message: 'Item deleted', data: { _id: item._id } });
});

/**
 * PATCH /api/items/:id/toggle-availability  { isAvailable? }
 * Without a body the current value is flipped.
 */
exports.toggleAvailability = asyncHandler(async (req, res) => {
  const item = await findItemOr404(req.params.id);
  item.isAvailable = typeof req.body.isAvailable === 'boolean' ? req.body.isAvailable : !item.isAvailable;
  await item.save();
  res.json({
    success: true,
    message: `"${item.name}" is now ${item.isAvailable ? 'available' : 'unavailable'}`,
    data: item,
  });
});

/**
 * PATCH /api/items/:id/stock
 *   { stock: 50 }        -> set stock to exactly 50
 *   { adjustBy: 20 }     -> add 20 (new purchase)
 *   { adjustBy: -3 }     -> remove 3 (damage / wastage)
 *   { lowStockLimit: 10 } may be sent along with either
 */
exports.updateStock = asyncHandler(async (req, res) => {
  const { stock, adjustBy, lowStockLimit } = req.body;
  let item = await findItemOr404(req.params.id);

  if (adjustBy !== undefined) {
    // Atomic change so simultaneous orders are never overwritten
    const guard = adjustBy < 0 ? { stock: { $gte: -adjustBy } } : {};
    const result = await Item.adjustStock(item._id, adjustBy, guard);
    if (result.modifiedCount === 0) {
      throw new AppError(`Stock cannot go below zero. Current stock is ${item.stock} ${item.unit}.`, 400);
    }
    item = await findItemOr404(item._id);
  } else if (stock !== undefined) {
    item.stock = round3(stock);
  }

  if (lowStockLimit !== undefined) item.lowStockLimit = lowStockLimit;
  await item.save();

  res.json({ success: true, message: 'Stock updated', data: item });
});

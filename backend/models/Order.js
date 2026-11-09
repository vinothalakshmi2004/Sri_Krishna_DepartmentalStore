/**
 * Order - a customer order placed from the public landing page.
 *
 * Each order line stores a SNAPSHOT of the item name, unit and price at the
 * moment of ordering, so later price changes never alter past orders.
 */
const mongoose = require('mongoose');
const { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_PAYMENT_MODES } = require('../utils/constants');

const orderItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // unit price at order time (offer price if one applied)
    originalPrice: { type: Number, min: 0 }, // regular price, only set when an offer lowered it
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: [0.001, 'Quantity must be more than 0'] },
    total: { type: Number, required: true, min: 0 }, // price x quantity
  },
  { _id: false }
);

/**
 * A line the customer typed in themselves ("Your own order"): free-text name and
 * quantity, not linked to the item catalogue and no stock is reserved. The store
 * fills in `amount` (the price of the whole line) after checking with the customer.
 */
const customItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: [80, 'Item name must be at most 80 characters'] },
    quantity: { type: String, trim: true, maxlength: [40, 'Quantity must be at most 40 characters'], default: '' }, // e.g. "2 kg", "1 packet"
    amount: { type: Number, min: 0, default: null }, // price for this line, null until the store sets it
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Human friendly ID, e.g. ORD-0001 (generated with the Counter model)
    orderId: { type: String, required: true, unique: true },

    // Customer details (no customer accounts - details are typed on each order)
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [80, 'Name must be at most 80 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\d{10}$/, 'Phone number must be exactly 10 digits'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [300, 'Address must be at most 300 characters'],
    },
    landmark: { type: String, trim: true, maxlength: 120, default: '' },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^\d{6}$/, 'Pincode must be 6 digits'],
    },
    note: { type: String, trim: true, maxlength: 300, default: '' }, // customer's note

    items: {
      type: [orderItemSchema],
      validate: [
        function hasLines(list) {
          return (Array.isArray(list) && list.length > 0) || (Array.isArray(this.customItems) && this.customItems.length > 0);
        },
        'Order must contain at least one item',
      ],
    },
    // Items the customer typed in themselves (see customItemSchema)
    customItems: { type: [customItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 }, // catalogue lines + priced custom lines
    deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    status: { type: String, enum: ORDER_STATUSES, default: 'New' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    paymentMode: { type: String, enum: ORDER_PAYMENT_MODES, default: 'None' },

    adminNote: { type: String, trim: true, maxlength: 500, default: '' }, // private - admins only
    // Message from the store, shown to the customer on the Track Order page
    customerMessage: { type: String, trim: true, maxlength: 500, default: '' },
    customerMessageAt: { type: Date },
    statusHistory: { type: [statusHistorySchema], default: [] },

    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    paidAt: { type: Date },

    // Set once stock has been put back (cancel/delete) so it never happens twice
    stockRestored: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ phone: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);

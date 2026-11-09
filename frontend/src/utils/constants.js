/**
 * Shared constants. Values must match the backend enums.
 */

export const ORDER_STATUSES = ['New', 'Confirmed', 'OutForDelivery', 'Delivered', 'Cancelled'];

export const STATUS_META = {
  New: { label: 'New', color: 'blue' },
  Confirmed: { label: 'Confirmed', color: 'indigo' },
  OutForDelivery: { label: 'Out for Delivery', color: 'amber' },
  Delivered: { label: 'Delivered', color: 'green' },
  Cancelled: { label: 'Cancelled', color: 'red' },
};

/** Normal order journey shown to customers (Cancelled is a side exit) */
export const STATUS_FLOW = ['New', 'Confirmed', 'OutForDelivery', 'Delivered'];

/** What the customer sees on the Track Order page for each status set by the admin */
export const CUSTOMER_STATUS = {
  New: { label: 'Order Placed', text: 'We have received your order. The store will confirm it shortly.' },
  Confirmed: { label: 'Confirmed', text: 'Your order is confirmed and is being packed.' },
  OutForDelivery: { label: 'Out for Delivery', text: 'Your order is on the way to you!' },
  Delivered: { label: 'Delivered', text: 'Your order has been delivered. Thank you for shopping with us!' },
  Cancelled: { label: 'Cancelled', text: 'This order was cancelled.' },
};

/** Next step button label in the admin order list */
export const NEXT_STATUS_ACTION = {
  New: { status: 'Confirmed', label: 'Confirm' },
  Confirmed: { status: 'OutForDelivery', label: 'Dispatch' },
  OutForDelivery: { status: 'Delivered', label: 'Delivered' },
};

export const PAYMENT_STATUSES = ['Pending', 'Paid'];

/** Modes an order can be paid with (None = not paid yet) */
export const ORDER_PAYMENT_MODES = ['Cash', 'GPay', 'PhonePe', 'UPI', 'Other'];

/** Modes for income / expense entries */
export const LEDGER_PAYMENT_MODES = ['Cash', 'GPay', 'PhonePe', 'UPI', 'Card', 'BankTransfer', 'Other'];

export const PAYMENT_MODE_LABELS = {
  BankTransfer: 'Bank Transfer',
  None: '—',
};
export const paymentModeLabel = (mode) => PAYMENT_MODE_LABELS[mode] || mode || '—';

export const EXPENSE_CATEGORIES = ['Purchase', 'Salary', 'Rent', 'Electricity', 'Transport', 'Other'];

export const ITEM_UNITS = ['kg', 'g', 'litre', 'piece', 'packet'];

/** Units that can be bought in halves (0.5 kg, 1.5 litre ...) */
export const FRACTIONAL_UNITS = ['kg', 'litre'];

export const MAX_ORDER_QTY = 1000;

/** Offer status (from the backend) -> label + badge colour */
export const OFFER_STATUS_META = {
  Active: { label: 'Live', color: 'green' },
  Scheduled: { label: 'Scheduled', color: 'blue' },
  Paused: { label: 'Paused', color: 'gray' },
  Expired: { label: 'Expired', color: 'red' },
};

/** Chart / badge palette */
// The first three follow the website colour theme
export const CHART_COLORS = ['var(--color-brand-500)', 'var(--color-brand-800)', 'var(--color-brand-300)', '#F59E0B', '#0EA5E9', '#8B5CF6', '#EF4444', '#14B8A6'];

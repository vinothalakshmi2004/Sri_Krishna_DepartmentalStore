/**
 * Safe localStorage / sessionStorage helpers (private browsing can throw).
 */

export const STORAGE_KEYS = {
  customer: 'greenmart_customer', // saved checkout details for repeat customers
  lastOrder: 'greenmart_last_order', // shown on the success page after a refresh
  clearCartFor: 'greenmart_clear_cart_for', // success page clears the cart once for this order
  myOrders: 'greenmart_my_orders', // orders placed on this phone (for one-tap tracking)
};

const MAX_MY_ORDERS = 10;

/** Orders placed from this device, newest first: [{ orderId, phone, grandTotal, createdAt }] */
export const readMyOrders = () => {
  const list = readJSON(STORAGE_KEYS.myOrders);
  return Array.isArray(list) ? list.filter((o) => o && o.orderId && o.phone) : [];
};

/** Remember an order placed on this device so the customer can track it with one tap */
export const saveMyOrder = (order) => {
  const entry = { orderId: order.orderId, phone: order.phone, grandTotal: order.grandTotal, createdAt: order.createdAt };
  const list = [entry, ...readMyOrders().filter((o) => o.orderId !== order.orderId)].slice(0, MAX_MY_ORDERS);
  writeJSON(STORAGE_KEYS.myOrders, list);
};

export const readJSON = (key, storage = localStorage) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeJSON = (key, value, storage = localStorage) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

export const removeKey = (key, storage = localStorage) => {
  try {
    storage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

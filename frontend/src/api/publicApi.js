/**
 * Public API - used by the customer website (no login).
 */
import api from './client';

const PUBLIC = { skipAuth: true };

export const publicApi = {
  /** Store information shown on the landing page */
  getSettings: () => api.get('/public/settings', PUBLIC).then((res) => res.data.data),

  /** Available items. params: { category, search, inStock } */
  getItems: (params) => api.get('/public/items', { ...PUBLIC, params }).then((res) => res.data.data),

  getCategories: () => api.get('/public/categories', PUBLIC).then((res) => res.data.data),

  /** Live offers for the "Offer Zone" */
  getOffers: () => api.get('/public/offers', PUBLIC).then((res) => res.data.data),

  /** Place an order. Returns { success, message, data: { orderId, ... } } */
  placeOrder: (payload) => api.post('/public/orders', payload, PUBLIC).then((res) => res.data),

  /** Customer's view of an order (status, comments and message from the store) */
  trackOrder: (orderId, phone) =>
    api
      .get(`/public/orders/track/${encodeURIComponent(orderId.trim())}`, { ...PUBLIC, params: { phone } })
      .then((res) => res.data.data),
};

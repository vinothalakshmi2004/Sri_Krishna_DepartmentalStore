/**
 * Admin API services (all need the admin JWT, added by the Axios client).
 * List calls return the full body: { data, pagination, ...extras }.
 */
import api from './client';

const body = (res) => res.data;
const dataOf = (res) => res.data.data;

/** Remove empty values so they are not sent as query params. */
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }).then(dataOf),
  // skipAuthRedirect: a stale token found on start-up is cleared quietly
  me: () => api.get('/auth/me', { skipAuthRedirect: true }).then(dataOf),
  changePassword: (oldPassword, newPassword) =>
    api.put('/auth/change-password', { oldPassword, newPassword }).then(body),
  changeUsername: (username, name) => api.put('/auth/change-username', { username, name }).then(body),
};

export const itemsApi = {
  list: (params) => api.get('/items', { params: clean(params) }).then(body),
  categories: () => api.get('/items/categories').then(dataOf),
  get: (id) => api.get(`/items/${id}`).then(dataOf),
  /** formData: FormData with fields + optional "image" file */
  create: (formData) => api.post('/items', formData).then(body),
  /** payload: FormData or a plain object (quick edits) */
  update: (id, payload) => api.put(`/items/${id}`, payload).then(body),
  remove: (id) => api.delete(`/items/${id}`).then(body),
  toggleAvailability: (id, isAvailable) =>
    api.patch(`/items/${id}/toggle-availability`, isAvailable === undefined ? {} : { isAvailable }).then(body),
  /** payload: { stock } | { adjustBy } and/or { lowStockLimit } */
  updateStock: (id, payload) => api.patch(`/items/${id}/stock`, payload).then(body),
  /** -> { barcode, item (already in the store) | null, product (details found online) | null, unreachable } */
  lookupBarcode: (code) => api.get(`/items/barcode/${encodeURIComponent(code)}`, { timeout: 45000 }).then(dataOf),
};

export const offersApi = {
  /** params: { status: active|scheduled|paused|expired, search } -> { data, statusCounts } */
  list: (params) => api.get('/offers', { params: clean(params) }).then(body),
  /** formData: FormData with offer fields + optional "image" file */
  create: (formData) => api.post('/offers', formData).then(body),
  update: (id, payload) => api.put(`/offers/${id}`, payload).then(body),
  toggle: (id, isActive) => api.patch(`/offers/${id}/toggle`, isActive === undefined ? {} : { isActive }).then(body),
  repeatToday: (id) => api.patch(`/offers/${id}/repeat-today`).then(body),
  remove: (id) => api.delete(`/offers/${id}`).then(body),
};

export const ordersApi = {
  list: (params) => api.get('/orders', { params: clean(params) }).then(body),
  get: (id) => api.get(`/orders/${encodeURIComponent(id)}`).then(dataOf),
  updateStatus: (id, status, note) => api.patch(`/orders/${id}/status`, { status, note }).then(body),
  updatePayment: (id, paymentStatus, paymentMode) =>
    api.patch(`/orders/${id}/payment`, { paymentStatus, paymentMode }).then(body),
  updateNote: (id, adminNote) => api.patch(`/orders/${id}/note`, { adminNote }).then(body),
  /** Prices for the customer's own (typed-in) items, one per line (null = not priced) */
  updateCustomItems: (id, amounts) => api.patch(`/orders/${id}/custom-items`, { amounts }).then(body),
  /** Message shown to the customer on the Track Order page ("" removes it) */
  updateCustomerMessage: (id, customerMessage) => api.patch(`/orders/${id}/customer-message`, { customerMessage }).then(body),
  cancel: (id, reason) => api.patch(`/orders/${id}/cancel`, { reason }).then(body),
  remove: (id) => api.delete(`/orders/${id}`).then(body),
};

export const incomeApi = {
  list: (params) => api.get('/income', { params: clean(params) }).then(body),
  create: (payload) => api.post('/income', payload).then(body),
  update: (id, payload) => api.put(`/income/${id}`, payload).then(body),
  remove: (id) => api.delete(`/income/${id}`).then(body),
};

export const expensesApi = {
  list: (params) => api.get('/expenses', { params: clean(params) }).then(body),
  create: (payload) => api.post('/expenses', payload).then(body),
  update: (id, payload) => api.put(`/expenses/${id}`, payload).then(body),
  remove: (id) => api.delete(`/expenses/${id}`).then(body),
};

export const settingsApi = {
  get: () => api.get('/settings').then(dataOf),
  /** JSON update of text fields */
  update: (payload) => api.put('/settings', payload).then(body),
  /** FormData with logo / heroImage / galleryImages files */
  uploadImages: (formData) => api.put('/settings', formData).then(body),
  /** type: logo | heroImage | gallery (url required for gallery) */
  deleteImage: (type, url) => api.delete('/settings/image', { params: clean({ type, url }) }).then(body),
  getSystem: () => api.get('/settings/system').then(dataOf),
  updateSystem: (payload) => api.put('/settings/system', payload).then(body),
};

export const dashboardApi = {
  /** params: { range: today|week|month|custom, from, to } */
  stats: (params) => api.get('/dashboard/stats', { params: clean(params) }).then(dataOf),
};

export const customersApi = {
  list: (params) => api.get('/customers', { params: clean(params) }).then(body),
  get: (phone) => api.get(`/customers/${encodeURIComponent(phone)}`).then(dataOf),
};

/** Read the JSON error hidden inside a Blob response (failed CSV download). */
const blobErrorMessage = async (error) => {
  try {
    const text = await error.response.data.text();
    return JSON.parse(text).message;
  } catch {
    return null;
  }
};

/** GET a file from the API and save it with the server's file name. Returns the file name. */
const downloadFile = async (path, params, fallbackName) => {
  try {
    const res = await api.get(path, { params: clean(params), responseType: 'blob' });
    const disposition = res.headers['content-disposition'] || '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const fileName = match ? match[1] : fallbackName;

    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return fileName;
  } catch (error) {
    if (error.response && error.response.data instanceof Blob) {
      const message = await blobErrorMessage(error);
      if (message) error.response.data = { message };
    }
    throw error;
  }
};

export const backupApi = {
  /** Collections and document counts */
  summary: () => api.get('/backup/summary').then(dataOf),
  /** Whole database as one .json file */
  downloadData: () => downloadFile('/backup/data', {}, 'store-backup.json'),
  /** Collections, fields and indexes as an Excel-friendly .csv */
  downloadStructure: () => downloadFile('/backup/structure', {}, 'db-structure.csv'),
};

export const reportsApi = {
  /**
   * Download a CSV report and save it.
   * type: orders | income | expenses, params: { from, to, ... }
   */
  download: (type, params) => downloadFile(`/reports/${type}`, params, `${type}.csv`),
};


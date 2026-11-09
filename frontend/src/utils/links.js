/**
 * Phone, WhatsApp, Google Maps and image URL helpers.
 */
import { API_URL } from '../api/client';
import { formatCurrency, formatQty } from './format';

/** Stored image path ("/uploads/items/x.jpg") -> full URL */
export const imageUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

/** Digits only, with the India code for 10 digit numbers (for wa.me) */
export const toWhatsAppNumber = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
};

export const whatsappLink = (phone, text) =>
  `https://wa.me/${toWhatsAppNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const telLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

export const mailLink = (email) => `mailto:${email}`;

export const mapsLink = (...parts) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(', '))}`;

/** Message the store sends to a customer about their order */
export const orderWhatsappMessage = (order, storeName = 'our store') => {
  const lines = [
    `Hello ${order.customerName},`,
    `Thank you for ordering from ${storeName}!`,
    '',
    `Order ID: ${order.orderId}`,
    ...order.items.map((i) => `• ${i.name} - ${formatQty(i.quantity, i.unit)} = ${formatCurrency(i.total)}`),
    ...(order.customItems || []).map(
      (i) => `• ${i.name}${i.quantity ? ` - ${i.quantity}` : ''} = ${i.amount === null || i.amount === undefined ? 'price to be confirmed' : formatCurrency(i.amount)}`
    ),
    '',
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Delivery: ${order.deliveryCharge ? formatCurrency(order.deliveryCharge) : 'Free'}`,
    `Total: ${formatCurrency(order.grandTotal)}`,
    '',
    `Payment: ${order.paymentStatus === 'Paid' ? `Paid (${order.paymentMode})` : 'Pay on delivery'}`,
  ];
  return lines.join('\n');
};

const INSTAGRAM_ID = /^@?([A-Za-z0-9._]{1,30})$/;
const INSTAGRAM_LINK = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i;

/** "srikrishnastore", "@srikrishnastore" or a full link -> https://www.instagram.com/srikrishnastore/ ('' stays '') */
export const instagramUrl = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const id = INSTAGRAM_ID.exec(text);
  return id ? `https://www.instagram.com/${id[1]}/` : text;
};

/** Saved Instagram link -> just the ID for the admin form (other links are kept as they are) */
export const instagramId = (url) => {
  const text = String(url || '').trim();
  const match = INSTAGRAM_LINK.exec(text);
  return match ? match[1] : text;
};

/** True for an Instagram ID or an http(s) link */
export const isInstagramValue = (value) => {
  const text = String(value || '').trim();
  return !text || INSTAGRAM_ID.test(text) || /^https?:\/\/\S+$/i.test(text);
};

/** Built-in enquiry message for the WhatsApp buttons on the home page */
export const enquiryWhatsappMessage = (storeName = 'Sri Krishna Department Store') =>
  `Hello ${storeName}! I would like to make an enquiry about your products and home delivery. Please share the details. Thank you!`;

/** Message a customer sends to the store after ordering */
export const customerWhatsappMessage = (orderId, name) =>
  `Hi, I${name ? ` (${name})` : ''} just placed order ${orderId} on your website.`;

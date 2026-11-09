/**
 * Formatting helpers: Indian currency, DD-MM-YYYY hh:mm A dates, quantities.
 */
import { FRACTIONAL_UNITS } from './constants';

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const inrDecimal = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** 123456.5 -> "₹1,23,456.50", 250 -> "₹250" */
export const formatCurrency = (value) => {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(n) ? inrWhole.format(n) : inrDecimal.format(n);
};

/** Short form for chart axes: ₹1.2K, ₹3.4L */
export const formatCompactCurrency = (value) => inrCompact.format(Number(value) || 0);

export const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value) || 0);

const pad = (n) => String(n).padStart(2, '0');

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "20-10-2026" */
export const formatDate = (value) => {
  const d = toDate(value);
  return d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : '—';
};

/** "07:45 PM" */
export const formatTime = (value) => {
  const d = toDate(value);
  if (!d) return '—';
  const hours = d.getHours();
  const h12 = hours % 12 || 12;
  return `${pad(h12)}:${pad(d.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
};

/** "20-10-2026 07:45 PM" */
export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? `${formatDate(d)} ${formatTime(d)}` : '—';
};

/** "just now", "5 min ago", "2 hr ago", or the date */
export const timeAgo = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDateTime(d);
};

/** Local date -> "YYYY-MM-DD" (for <input type="date"> and API filters) */
export const toInputDate = (value = new Date()) => {
  const d = toDate(value) || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Round a quantity to 3 decimals and drop trailing zeros */
export const roundQty = (value) => Math.round((Number(value) || 0) * 1000) / 1000;

const PLURAL_UNITS = { piece: 'pieces', packet: 'packets', litre: 'litres' };

/** (2, 'piece') -> "2 pieces", (0.5, 'kg') -> "0.5 kg" */
export const formatQty = (quantity, unit) => {
  const qty = roundQty(quantity);
  const label = qty !== 1 && PLURAL_UNITS[unit] ? PLURAL_UNITS[unit] : unit;
  return `${qty} ${label || ''}`.trim();
};

const SHORT_UNITS = {
  piece: ['pc', 'pcs'],
  packet: ['pkt', 'pkts'],
  litre: ['L', 'L'],
};

/** Short form for small screens: (2, 'piece') -> "2 pcs", (1, 'litre') -> "1 L" */
export const formatQtyShort = (quantity, unit) => {
  const qty = roundQty(quantity);
  const short = SHORT_UNITS[unit];
  return `${qty} ${short ? short[qty === 1 ? 0 : 1] : unit || ''}`.trim();
};

/** Step used by +/- buttons: 0.5 for kg/litre, 1 for everything else */
export const getQtyStep = (unit) => (FRACTIONAL_UNITS.includes(unit) ? 0.5 : 1);

/** "per kg", "per packet" */
export const perUnit = (unit) => `per ${unit}`;

/** Initials for avatars: "Ravi Kumar" -> "RK" */
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'A';

/**
 * Small, dependency-free helpers shared across controllers.
 */
const AppError = require('./AppError');

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** Round to 2 decimals (money values). */
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Round to 3 decimals (quantities / stock such as 0.25 kg). */
const round3 = (value) => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

/** Escape user input before using it inside a RegExp (prevents regex injection). */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True for a 24 character hex MongoDB ObjectId string. */
const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

/**
 * Normalise an Indian phone number to plain 10 digits.
 * "+91 98765-43210" -> "9876543210", "09876543210" -> "9876543210".
 * Anything else is returned as digits only and will fail 10-digit validation.
 */
const normalizePhone = (value) => {
  if (value === undefined || value === null) return value;
  let digits = String(value).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

/**
 * Accept an array, a JSON array string or a comma separated string and
 * return a clean array of trimmed, non-empty strings.
 * Useful for multipart/form-data where arrays arrive as text.
 */
const toStringArray = (value) => {
  if (value === undefined || value === null) return value;
  let list = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        list = JSON.parse(trimmed);
      } catch (err) {
        list = trimmed.replace(/^\[|\]$/g, '').split(',');
      }
    } else {
      list = trimmed === '' ? [] : trimmed.split(',');
    }
  }
  if (!Array.isArray(list)) list = [list];
  return list.map((v) => String(v).replace(/["']/g, '').trim()).filter(Boolean);
};

/**
 * Accept a plain object or a JSON object string. Returns `null` when the
 * value cannot be turned into an object (so validators can reject it).
 */
const toPlainObject = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (err) {
      /* fall through */
    }
  }
  return null;
};

/** If an admin pastes the whole Google Maps <iframe> code, keep only its src URL. */
const extractEmbedSrc = (value) => {
  if (value === undefined || value === null) return value;
  const str = String(value).trim();
  const match = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(str);
  return match ? match[1] : str;
};

// ---------------------------------------------------------------------------
// Dates (all calculations use the server's local time zone)
// ---------------------------------------------------------------------------

const pad2 = (n) => String(n).padStart(2, '0');

/** Local date -> "YYYY-MM-DD" */
const toDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Local date -> "YYYY-MM-DD HH:mm" (used in CSV exports) */
const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${toDateKey(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Local date -> "21-10-2026 07:45 PM" (the format used across the app and in CSV exports) */
const formatDisplayDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const hours = d.getHours();
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(hours % 12 || 12)}:${pad2(d.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
};

/**
 * Parse a date from user input.
 * "YYYY-MM-DD" is treated as a LOCAL date (plain `new Date('2026-01-05')`
 * would give UTC midnight, which shifts the day in India).
 * Returns null for invalid input.
 */
const parseDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  const str = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Build a MongoDB range filter from optional "from"/"to" query values.
 * Both ends are inclusive whole days. Returns null when neither is given.
 *   buildDateFilter('2026-10-01', '2026-10-31') -> { $gte: ..., $lte: ... }
 */
const buildDateFilter = (from, to) => {
  const filter = {};
  if (from) {
    const d = parseDate(from);
    if (!d) throw new AppError('Invalid "from" date. Use YYYY-MM-DD.', 400);
    filter.$gte = startOfDay(d);
  }
  if (to) {
    const d = parseDate(to);
    if (!d) throw new AppError('Invalid "to" date. Use YYYY-MM-DD.', 400);
    filter.$lte = endOfDay(d);
  }
  if (filter.$gte && filter.$lte && filter.$gte > filter.$lte) {
    throw new AppError('"from" date must be on or before "to" date', 400);
  }
  return Object.keys(filter).length ? filter : null;
};

/**
 * Server time zone as "+05:30" style offset, used by MongoDB date grouping
 * so daily chart buckets match the store's local days.
 */
const getTimezoneOffsetString = () => {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
};

// ---------------------------------------------------------------------------
// Pagination & sorting
// ---------------------------------------------------------------------------

/** Read ?page & ?limit safely. */
const getPagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

/** Pagination block returned with every list response. */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.max(Math.ceil(total / limit), 1),
});

/**
 * Turn "?sort=-createdAt" / "?sort=price" into a MongoDB sort object.
 * Only whitelisted fields are allowed; anything else falls back to `fallback`.
 */
const buildSort = (sortParam, allowedFields, fallback = { createdAt: -1 }, tieBreaker = '_id') => {
  if (typeof sortParam !== 'string' || !sortParam.trim()) return fallback;
  const raw = sortParam.trim();
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  if (!allowedFields.includes(field)) return fallback;
  const sort = { [field]: desc ? -1 : 1 };
  if (tieBreaker && tieBreaker !== field) sort[tieBreaker] = desc ? -1 : 1;
  return sort;
};

module.exports = {
  round2,
  round3,
  escapeRegex,
  isObjectId,
  normalizePhone,
  toStringArray,
  toPlainObject,
  extractEmbedSrc,
  toDateKey,
  formatDateTime,
  formatDisplayDateTime,
  parseDate,
  startOfDay,
  endOfDay,
  buildDateFilter,
  getTimezoneOffsetString,
  getPagination,
  paginationMeta,
  buildSort,
};

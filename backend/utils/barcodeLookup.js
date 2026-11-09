/**
 * Barcode -> product details for the admin "Scan barcode" feature.
 *
 * Details come from the free Open Food Facts family of databases (food,
 * beauty and household products), with UPCitemdb as a last resort.
 * Nothing is saved here: the admin checks the details, adds price and stock,
 * and saves the item as usual.
 */

const OPEN_FACTS_SOURCES = [
  { name: 'Open Food Facts', site: 'https://world.openfoodfacts.org', kind: 'food' },
  { name: 'Open Beauty Facts', site: 'https://world.openbeautyfacts.org', kind: 'beauty' },
  { name: 'Open Products Facts', site: 'https://world.openproductsfacts.org', kind: 'product' },
];
const OPEN_FACTS_FIELDS = [
  'product_name', 'product_name_en', 'generic_name', 'generic_name_en',
  'brands', 'quantity', 'categories_tags', 'image_front_url', 'image_url',
].join(',');

// Product photos are only downloaded from these hosts (no redirects followed)
const IMAGE_HOSTS = new Set([
  'images.openfoodfacts.org',
  'images.openbeautyfacts.org',
  'images.openproductsfacts.org',
  'static.openfoodfacts.org',
]);
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const TIMEOUT_MS = 8000;
const USER_AGENT = 'SriKrishnaDepartmentStore/1.0 (store admin barcode lookup)';

// Only EAN-8, UPC-A, EAN-13 and GTIN-14 codes exist in the online databases
const ONLINE_CODE = /^(\d{8}|\d{12,14})$/;

/**
 * Store categories, most specific first. `tags` match Open Food Facts
 * category tags; `words` pick the store's own category name when it has one.
 */
const CATEGORY_RULES = [
  { name: 'Sauces & Pickles', words: ['sauce', 'pickle', 'spread', 'jam'], tags: ['sauces', 'ketchup', 'ketchups', 'pickles', 'spreads', 'jams', 'honeys', 'mayonnaises', 'chutneys'] },
  { name: 'Instant Food', words: ['instant', 'noodle', 'ready'], tags: ['noodles', 'instant-noodles', 'pastas', 'vermicelli', 'ready-meals', 'soups'] },
  { name: 'Breakfast & Cereals', words: ['breakfast', 'cereal', 'oat'], tags: ['breakfast-cereals', 'oats', 'oat-flakes', 'rolled-oats', 'cornflakes', 'mueslis'] },
  { name: 'Flours', words: ['flour', 'atta'], tags: ['flours', 'wheat-flours', 'atta', 'semolinas', 'semolina', 'besan', 'gram-flours'] },
  { name: 'Rice & Grains', words: ['rice', 'grain'], tags: ['rices', 'rice', 'cereal-grains', 'grains', 'millets', 'flattened-rice', 'poha', 'quinoa'] },
  { name: 'Pulses & Dals', words: ['pulse', 'dal', 'lentil'], tags: ['pulses', 'lentils', 'dals', 'chickpeas', 'beans', 'legumes'] },
  { name: 'Oils & Ghee', words: ['oil', 'ghee'], tags: ['oils', 'vegetable-oils', 'cooking-oils', 'ghee', 'ghees'] },
  { name: 'Dairy & Eggs', words: ['dairy', 'milk', 'egg'], tags: ['dairies', 'milks', 'cheeses', 'yogurts', 'butters', 'eggs', 'paneer', 'curds', 'creams'] },
  { name: 'Chocolates & Sweets', words: ['chocolate', 'sweet', 'confection'], tags: ['chocolates', 'confectioneries', 'candies', 'sweets'] },
  { name: 'Snacks & Biscuits', words: ['snack', 'biscuit'], tags: ['snacks', 'biscuits', 'cookies', 'crisps', 'chips', 'namkeen', 'crackers', 'cakes', 'rusks'] },
  { name: 'Spices & Masala', words: ['spice', 'masala'], tags: ['spices', 'masalas', 'spice-mixes', 'seasonings', 'salts', 'table-salts', 'herbs', 'condiments'] },
  { name: 'Beverages', words: ['beverage', 'drink', 'tea', 'coffee'], tags: ['beverages', 'drinks', 'teas', 'coffees', 'juices', 'sodas', 'waters', 'malt-drinks'] },
];
// Used when nothing more specific matches
const KIND_CATEGORY = {
  beauty: { name: 'Personal Care', words: ['personal', 'beauty', 'bath'] },
  product: { name: 'Household', words: ['household', 'home', 'clean'] },
};

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const compact = (value) => value.toLowerCase().replace(/\s+/g, '');

/** "kissan" -> "Kissan" (names that already have capitals are kept) */
const titleCase = (value) =>
  value === value.toLowerCase() ? value.replace(/(^|[\s(&/-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase()) : value;

/** "weight: 1.2kg" -> "1.2 kg", "Net Wt. 500g" -> "500 g". A bare number ("70") has no unit and is dropped. */
const cleanQuantity = (value) => {
  const size = clean(value)
    .replace(/^(net\s*(wt|weight|qty|quantity|content)?|weight|volume)\s*[.:-]?\s*/i, '')
    .replace(/(\d)\s*([a-zA-Z]+)/g, '$1 $2')
    .slice(0, 30);
  return /\d\s*[a-zA-Z]/.test(size) ? size : '';
};

const isLiquid = (quantity) => /\b\d+(\.\d+)?\s*(ml|l|ltr|litres?|liters?)\b/i.test(quantity);

/** Use the store's own category name when one already covers the rule */
const storeName = (rule, storeCategories) =>
  storeCategories.find((cat) => rule.words.some((word) => cat.toLowerCase().includes(word))) || rule.name;

const matchesTag = (tag, key) => tag === key || tag.endsWith(`-${key}`);

/** Pick a category from Open Food Facts tags (most specific tag first) or a free-text category */
const pickCategory = ({ tags = [], categoryText = '', kind }, storeCategories) => {
  const englishTags = tags.filter((t) => typeof t === 'string' && t.startsWith('en:')).map((t) => t.slice(3)).reverse();
  for (const tag of englishTags) {
    const rule = CATEGORY_RULES.find((r) => r.tags.some((key) => matchesTag(tag, key)));
    if (rule) return storeName(rule, storeCategories);
  }
  // UPCitemdb style "Food > Condiments > Ketchup": try the last part first
  const parts = categoryText.toLowerCase().split('>').map((p) => p.trim()).filter(Boolean).reverse();
  for (const part of parts) {
    const rule = CATEGORY_RULES.find((r) => r.words.some((word) => part.includes(word)));
    if (rule) return storeName(rule, storeCategories);
  }
  return KIND_CATEGORY[kind] ? storeName(KIND_CATEGORY[kind], storeCategories) : '';
};

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page means the service is down, not that the product is unknown
    throw new Error(`Unexpected response (HTTP ${res.status})`);
  }
};

/** Download a product photo as a data URL ('' when it is missing, too big or not allowed) */
const downloadImage = async (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !IMAGE_HOSTS.has(parsed.hostname)) return '';
    const res = await fetch(parsed, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPES.includes(type)) return '';
    if (Number(res.headers.get('content-length')) > MAX_IMAGE_BYTES) return '';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return '';
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
};

/** Turn raw database fields into item form values (category is picked later) */
const buildProduct = ({ name, generic, brand, quantity, description, tags, categoryText, imageUrl, kind }, source) => {
  const brandName = titleCase(clean(brand).split(',')[0].trim());
  const size = cleanQuantity(quantity);
  let title = clean(name) || clean(generic);
  if (!title && !brandName) return null;

  if (brandName && !title.toLowerCase().includes(brandName.toLowerCase())) title = `${brandName} ${title}`.trim();
  if (size && !compact(title).includes(compact(size))) title = `${title} ${size}`;

  const genericText = clean(generic);
  const details = [
    genericText && genericText.toLowerCase() !== clean(name).toLowerCase() ? genericText : clean(description),
    brandName && `Brand: ${brandName}`,
    size && `Pack size: ${size}`,
  ].filter(Boolean);

  return {
    name: title.slice(0, 100).trim(),
    brand: brandName,
    quantity: size,
    description: details.join(' · ').slice(0, 500),
    unit: kind === 'food' && !isLiquid(size) ? 'packet' : 'piece',
    imageUrl: imageUrl || '',
    source: source.name,
    sourceUrl: source.url || '',
    // used to pick the category
    tags: tags || [],
    categoryText: categoryText || '',
    kind,
  };
};

const lookupOpenFacts = async (source, code) => {
  const data = await fetchJson(`${source.site}/api/v2/product/${code}.json?fields=${OPEN_FACTS_FIELDS}`);
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  return buildProduct(
    {
      name: p.product_name_en || p.product_name,
      generic: p.generic_name_en || p.generic_name,
      brand: p.brands,
      quantity: p.quantity,
      tags: p.categories_tags,
      imageUrl: p.image_front_url || p.image_url,
      kind: source.kind,
    },
    { name: source.name, url: `${source.site}/product/${code}` }
  );
};

const lookupUpcItemDb = async (code) => {
  const data = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
  const hit = data && data.code === 'OK' && Array.isArray(data.items) ? data.items[0] : null;
  if (!hit || !hit.title) return null;
  return buildProduct(
    {
      name: hit.title,
      brand: hit.brand,
      quantity: hit.size,
      description: hit.description,
      categoryText: hit.category,
      kind: 'product',
    },
    { name: 'UPCitemdb' }
  );
};

// Small in-memory cache so scanning the same pack twice does not call the internet again
const CACHE_LIMIT = 100;
const FOUND_TTL = 12 * 60 * 60 * 1000;
const NOT_FOUND_TTL = 30 * 60 * 1000;
const cache = new Map();

const remember = (code, value, ttl) => {
  cache.delete(code);
  cache.set(code, { value, expires: Date.now() + ttl });
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
};

/** Look a code up online. Resolves to { product, unreachable } and never throws. */
const findOnline = async (code) => {
  const cached = cache.get(code);
  if (cached && cached.expires > Date.now()) return cached.value;

  // Ask every Open Facts database at once; the first one in the list that knows the code wins
  // and slower databases further down the list are not waited for.
  const attempts = OPEN_FACTS_SOURCES.map((source) =>
    lookupOpenFacts(source, code).then((found) => ({ found }), () => ({ failed: true }))
  );
  let failures = 0;
  let product = null;
  for (const attempt of attempts) {
    const { found, failed } = await attempt;
    if (failed) failures += 1;
    if (found) {
      product = found;
      break;
    }
  }

  if (!product) {
    try {
      product = await lookupUpcItemDb(code);
    } catch {
      failures += 1;
    }
  }

  if (product) {
    product.image = product.imageUrl ? await downloadImage(product.imageUrl) : '';
    const value = { product, unreachable: false };
    remember(code, value, FOUND_TTL);
    return value;
  }

  const unreachable = failures === OPEN_FACTS_SOURCES.length + 1;
  const value = { product: null, unreachable };
  if (!unreachable) remember(code, value, NOT_FOUND_TTL);
  return value;
};

/**
 * Product details for a barcode, ready for the item form:
 *   { product: { name, brand, quantity, description, unit, category, image (data URL), source, sourceUrl } | null,
 *     unreachable, online }
 * `online` is false for store-made codes that no online database knows.
 */
const lookupBarcode = async (code, storeCategories = []) => {
  if (!ONLINE_CODE.test(code)) return { product: null, unreachable: false, online: false };

  const { product, unreachable } = await findOnline(code);
  if (!product) return { product: null, unreachable, online: true };

  const { tags, categoryText, kind, imageUrl, ...rest } = product;
  return {
    product: { ...rest, category: pickCategory({ tags, categoryText, kind }, storeCategories) },
    unreachable: false,
    online: true,
  };
};

module.exports = { lookupBarcode, pickCategory, cleanQuantity };

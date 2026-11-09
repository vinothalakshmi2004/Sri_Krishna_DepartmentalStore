/**
 * Barcode reader settings shared by the page and the bulk-upload worker.
 * (Kept free of other imports so the worker bundle stays small.)
 */

// Same rule as the backend: EAN/UPC digits or the store's own code
export const BARCODE_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;

// Product and shelf-label barcodes (QR codes usually hold links, not product codes)
const FORMATS = ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39', 'Code93', 'ITF', 'Codabar'];

// Photos are scaled down to this before reading the barcode
export const MAX_SCAN_SIDE = 2400;
// Size of the photo copy saved as the product picture (bulk upload)
export const PRODUCT_PHOTO_SIDE = 1000;

/** `thorough` also tries inverted colours (slower; used for photos, not live camera frames) */
export const readerOptions = (thorough) => ({
  formats: FORMATS,
  maxNumberOfSymbols: 1,
  tryHarder: true,
  tryRotate: true,
  tryInvert: thorough,
  tryDownscale: true,
});

/** First valid code in zxing results, or null */
export const pickBarcode = (results) => {
  const hit = results.find((r) => r.isValid && BARCODE_PATTERN.test(r.text.trim()));
  return hit ? hit.text.trim() : null;
};

/** zxing looks for its .wasm file through this hook; serve it from our own site */
export const zxingOverrides = (wasmUrl) => ({
  locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
});

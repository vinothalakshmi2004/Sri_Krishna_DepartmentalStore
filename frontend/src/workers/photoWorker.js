/**
 * Bulk upload worker: reads the barcode in a photo and makes a smaller JPEG copy
 * to use as the product picture - off the main thread, so the page stays smooth
 * while hundreds of photos are processed.
 *
 *   in:  { id, file }
 *   out: { id, code, photo }  or  { id, error }
 */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { MAX_SCAN_SIDE, PRODUCT_PHOTO_SIDE, pickBarcode, readerOptions, zxingOverrides } from '../utils/barcodeOptions';

prepareZXingModule({ overrides: zxingOverrides(new URL(wasmUrl, self.location.origin).href) });

const draw = (bitmap, maxSide) => {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
};

self.onmessage = async ({ data: { id, file } }) => {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const big = draw(bitmap, MAX_SCAN_SIDE);
    const code = pickBarcode(await readBarcodes(big.ctx.getImageData(0, 0, big.canvas.width, big.canvas.height), readerOptions(true)));
    const small = draw(bitmap, PRODUCT_PHOTO_SIDE);
    const photo = await small.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    self.postMessage({ id, code, photo });
  } catch (err) {
    self.postMessage({ id, error: (err && err.message) || 'Could not read this photo' });
  } finally {
    if (bitmap) bitmap.close();
  }
};

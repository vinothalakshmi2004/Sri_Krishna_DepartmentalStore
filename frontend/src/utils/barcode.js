/**
 * Barcode reading in the browser with zxing-wasm.
 * The reader (about 1 MB) is only downloaded the first time a barcode is scanned.
 */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { MAX_SCAN_SIDE, PRODUCT_PHOTO_SIDE, pickBarcode, readerOptions, zxingOverrides } from './barcodeOptions';

export { BARCODE_PATTERN } from './barcodeOptions';

let readerPromise = null;

const loadReader = () => {
  if (!readerPromise) {
    readerPromise = import('zxing-wasm/reader')
      .then(async (zxing) => {
        await zxing.prepareZXingModule({ overrides: zxingOverrides(wasmUrl), fireImmediately: true });
        return zxing;
      })
      .catch((err) => {
        readerPromise = null; // allow a retry
        throw err;
      });
  }
  return readerPromise;
};

/** Start downloading the reader early (e.g. while the camera starts) */
export const preloadBarcodeReader = () => loadReader().catch(() => {});

/** Camera can only be opened on https pages (or localhost) */
export const canUseCamera = () =>
  typeof window !== 'undefined' && window.isSecureContext && Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

/**
 * Find a barcode in an ImageData (a camera frame or a scaled-down photo).
 * Resolves to the code text, or null when there is none.
 */
export async function readBarcode(image, { thorough = false } = {}) {
  const { readBarcodes } = await loadReader();
  return pickBarcode(await readBarcodes(image, readerOptions(thorough)));
}

const loadImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Draw an image scaled down to fit maxSide (transparent parts become white) */
const drawScaled = (image, maxSide) => {
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
};

/** Read a barcode from a photo file. Big phone photos are scaled down first to save memory. */
export async function readBarcodeFromPhoto(file) {
  const image = await loadImage(file);
  try {
    const { canvas, ctx } = drawScaled(image, MAX_SCAN_SIDE);
    return await readBarcode(ctx.getImageData(0, 0, canvas.width, canvas.height), { thorough: true });
  } finally {
    if (image.close) image.close();
  }
}

/** Bulk upload on the main thread: { code, photo (smaller JPEG copy for the product picture) } */
async function preparePhoto(file) {
  const image = await loadImage(file);
  try {
    const big = drawScaled(image, MAX_SCAN_SIDE);
    const code = await readBarcode(big.ctx.getImageData(0, 0, big.canvas.width, big.canvas.height), { thorough: true });
    const small = drawScaled(image, PRODUCT_PHOTO_SIDE);
    const photo = await new Promise((resolve) => small.canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return { code, photo };
  } finally {
    if (image.close) image.close();
  }
}

/**
 * Reads bulk-upload photos in a background worker so the page stays responsive.
 * Falls back to the main thread where a worker cannot draw images (older Safari).
 *   const reader = createPhotoReader();  await reader.read(file);  reader.close();
 */
export function createPhotoReader() {
  const waiting = new Map(); // id -> { file, resolve, reject }
  let nextId = 0;
  let worker = null;

  const fallBack = () => {
    if (worker) worker.terminate();
    worker = null;
    const jobs = [...waiting.values()];
    waiting.clear();
    jobs.forEach((job) => preparePhoto(job.file).then(job.resolve, job.reject));
  };

  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function') {
    try {
      worker = new Worker(new URL('../workers/photoWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        const job = waiting.get(data.id);
        if (!job) return;
        waiting.delete(data.id);
        if (data.error) job.reject(new Error(data.error));
        else job.resolve({ code: data.code, photo: data.photo });
      };
      worker.onerror = fallBack; // the worker could not start
    } catch {
      worker = null;
    }
  }

  return {
    read(file) {
      if (!worker) return preparePhoto(file);
      nextId += 1;
      const id = nextId;
      return new Promise((resolve, reject) => {
        waiting.set(id, { file, resolve, reject });
        worker.postMessage({ id, file });
      });
    },
    close() {
      if (worker) worker.terminate();
      worker = null;
      waiting.forEach((job) => job.reject(new Error('Stopped')));
      waiting.clear();
    },
  };
}

/** Product photo sent by the server as a data URL -> File for the normal image upload */
export async function dataUrlToFile(dataUrl, baseName) {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[blob.type] || 'jpg';
  return new File([blob], `${baseName}.${ext}`, { type: blob.type || 'image/jpeg' });
}

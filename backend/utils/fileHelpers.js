/**
 * Helpers for files stored in the /uploads folder.
 *
 * Files are saved on disk by multer and stored in MongoDB as a public URL
 * path such as "/uploads/items/1729412345678-a1b2c3.jpg". The frontend
 * prefixes it with the API base URL to show the image.
 */
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

/** Disk path of a multer file -> public URL path ("/uploads/items/x.jpg"). */
const toPublicPath = (file) =>
  `/uploads/${path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/')}`;

/**
 * Accept "/uploads/..." or a full URL like "http://host:5000/uploads/..."
 * and return the "/uploads/..." part (or the original string).
 */
const normalizeUploadPath = (value) => {
  if (!value || typeof value !== 'string') return value;
  const index = value.indexOf('/uploads/');
  return index >= 0 ? value.slice(index) : value;
};

/**
 * Delete an uploaded file by its public path.
 * Ignores files that are already gone and refuses anything outside /uploads.
 */
const removeUpload = async (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string' || !publicPath.startsWith('/uploads/')) return;
  const absolute = path.resolve(UPLOAD_ROOT, publicPath.replace(/^\/uploads\//, ''));
  if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) return; // path traversal guard
  try {
    await fs.promises.unlink(absolute);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[uploads] Could not delete ${publicPath}: ${err.message}`);
  }
};

/** Collect every file multer attached to the request (single, array or fields). */
const getRequestFiles = (req) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((list) => files.push(...list));
  }
  return files;
};

/** Remove files uploaded during a request that ended in an error. */
const cleanupRequestFiles = async (req) => {
  const files = getRequestFiles(req);
  await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
};

module.exports = {
  UPLOAD_ROOT,
  toPublicPath,
  normalizeUploadPath,
  removeUpload,
  cleanupRequestFiles,
};

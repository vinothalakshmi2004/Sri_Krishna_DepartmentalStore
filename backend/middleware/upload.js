/**
 * Image upload middleware (multer, stored on disk under /uploads).
 *
 *   uploads/items/     -> item images        (field: "image")
 *   uploads/offers/    -> offer images       (field: "image")
 *   uploads/settings/  -> logos, hero, gallery (fields: "logo", "logoFull", "heroImage", "galleryImages")
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');
const { UPLOAD_ROOT } = require('../utils/fileHelpers');

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const MAX_GALLERY_UPLOAD = 10; // gallery images per request

// Allowed image types -> file extension we save with
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Build a multer instance that saves images into uploads/<subFolder>. */
const createUploader = (subFolder) => {
  const destination = path.join(UPLOAD_ROOT, subFolder);
  fs.mkdirSync(destination, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Re-create the folder if someone deleted it while the server was running
      fs.mkdir(destination, { recursive: true }, (err) => cb(err, destination));
    },
    // Random file name - never trust the original name from the client
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      cb(null, `${unique}${MIME_EXTENSIONS[file.mimetype]}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (MIME_EXTENSIONS[file.mimetype]) return cb(null, true);
    return cb(new AppError('Only JPG, PNG, WEBP or GIF images are allowed', 400));
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: MAX_GALLERY_UPLOAD + 2 },
  });
};

const itemUploader = createUploader('items');
const settingsUploader = createUploader('settings');
const offerUploader = createUploader('offers');

module.exports = {
  // Single item image (optional)
  uploadItemImage: itemUploader.single('image'),

  // Single offer banner image (optional)
  uploadOfferImage: offerUploader.single('image'),

  // Store images: logos, hero banner and up to 10 gallery images per request
  uploadSettingsImages: settingsUploader.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'logoFull', maxCount: 1 },
    { name: 'heroImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: MAX_GALLERY_UPLOAD },
  ]),

  MAX_UPLOAD_MB,
};

/**
 * Store settings (admin) and system (.env) settings.
 */
const { matchedData } = require('express-validator');
const Settings = require('../models/Settings');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicPath, removeUpload, normalizeUploadPath } = require('../utils/fileHelpers');
const { resolveMapEmbed } = require('../utils/mapLink');
const {
  EDITABLE_ENV_KEYS,
  readEnvValues,
  updateEnvFile,
  maskMongoUri,
  maskSecret,
} = require('../utils/envFile');

const MAX_GALLERY_IMAGES = 20;

// Plain fields copied straight from the validated body
const SIMPLE_FIELDS = [
  'storeName', 'tagline', 'about', 'phone', 'extraPhones', 'whatsapp', 'email', 'address',
  'mapLink', 'mapEmbedUrl', 'openingHours', 'deliveryCharge', 'freeDeliveryAbove',
  'minOrderAmount', 'isStoreOpen', 'offersEnabled', 'allowedPincodes',
];

// Single-image settings fields that can be uploaded / deleted
const SINGLE_IMAGE_FIELDS = ['logo', 'logoFull', 'heroImage'];
const IMAGE_LABELS = { logo: 'logo', logoFull: 'full logo', heroImage: 'hero image' };

const SYSTEM_WARNING =
  'WARNING: These values control how the whole system runs. A wrong MONGO_URI will stop the ' +
  'server from reaching the database, changing JWT_SECRET logs out every admin, and changing ' +
  'PORT or CLIENT_URL requires matching changes in the frontend. Changes are saved to the .env ' +
  'file (the previous version is kept as .env.backup) and only take effect after the server is restarted.';

/** GET /api/settings */
exports.getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Settings.getSingleton() });
});

/**
 * PUT /api/settings
 * JSON or multipart/form-data. Optional files:
 *   logo (1), logoFull (1), heroImage (1) -> replace the current image
 *   galleryImages (up to 10 per request) -> appended to the gallery (max 20 total)
 * In multipart requests, socialLinks can be sent as JSON text or as
 * socialLinks[facebook]=..., and allowedPincodes as "600001,600002".
 */
exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const data = matchedData(req, { locations: ['body'] });
  const files = req.files || {};
  const replacedFiles = [];
  let notice = '';

  // A new Google Maps link builds the website map automatically
  // (unless the admin also typed a map embed by hand in the same save)
  const mapLinkChanged = data.mapLink !== undefined && data.mapLink !== settings.mapLink;
  const embedTypedByHand = data.mapEmbedUrl !== undefined && data.mapEmbedUrl !== settings.mapEmbedUrl;

  SIMPLE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) settings[field] = data[field];
  });

  if (mapLinkChanged && data.mapLink && !embedTypedByHand) {
    const embed = await resolveMapEmbed(data.mapLink);
    if (embed) settings.mapEmbedUrl = embed;
    else notice = 'Saved, but the map preview could not be created from this link. Check the link or paste the embed code instead.';
  }

  if (data.socialLinks) {
    Object.entries(data.socialLinks).forEach(([key, value]) => settings.set(`socialLinks.${key}`, value));
  }
  if (data.theme) {
    Object.entries(data.theme).forEach(([key, value]) => settings.set(`theme.${key}`, value));
  }
  if (data.animation) {
    Object.entries(data.animation).forEach(([key, value]) => settings.set(`animation.${key}`, value));
  }

  SINGLE_IMAGE_FIELDS.forEach((field) => {
    if (files[field] && files[field][0]) {
      if (settings[field]) replacedFiles.push(settings[field]);
      settings[field] = toPublicPath(files[field][0]);
    }
  });
  if (files.galleryImages && files.galleryImages.length) {
    const total = settings.galleryImages.length + files.galleryImages.length;
    if (total > MAX_GALLERY_IMAGES) {
      // The error handler deletes the files uploaded with this request
      throw new AppError(
        `Gallery can hold at most ${MAX_GALLERY_IMAGES} images. It has ${settings.galleryImages.length}; delete some first.`,
        400
      );
    }
    settings.galleryImages.push(...files.galleryImages.map(toPublicPath));
  }

  await settings.save();
  await Promise.all(replacedFiles.map(removeUpload));

  res.json({ success: true, message: 'Settings updated', ...(notice && { notice }), data: settings });
});

/**
 * DELETE /api/settings/image?type=logo|logoFull|heroImage|gallery&url=/uploads/settings/x.jpg
 * `url` is required for gallery images (it may also be the full image URL).
 */
exports.deleteImage = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const settings = await Settings.getSingleton();
  let removed;

  if (type === 'gallery') {
    const url = normalizeUploadPath(req.query.url);
    const index = settings.galleryImages.indexOf(url);
    if (index === -1) throw new AppError('Image not found in gallery', 404);
    [removed] = settings.galleryImages.splice(index, 1);
  } else {
    if (!settings[type]) throw new AppError(`No ${IMAGE_LABELS[type] || 'image'} to delete`, 404);
    removed = settings[type];
    settings[type] = '';
  }

  await settings.save();
  await removeUpload(removed);

  res.json({ success: true, message: 'Image deleted', data: settings });
});

/** Current running configuration with secrets masked. */
const describeSystem = async () => {
  const fileValues = await readEnvValues();
  const secret = process.env.JWT_SECRET || '';

  // .env edited but server not restarted yet?
  const restartRequired = EDITABLE_ENV_KEYS.some(
    (key) => fileValues[key] !== undefined && fileValues[key] !== (process.env[key] || '')
  );

  return {
    mongoUri: maskMongoUri(process.env.MONGO_URI),
    jwt: {
      secret: maskSecret(secret),
      secretLength: secret.length,
      isWeakSecret: secret.length < 32 || /change_?me|secret|test/i.test(secret),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    port: process.env.PORT || '5000',
    clientUrl: process.env.CLIENT_URL || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    editableKeys: EDITABLE_ENV_KEYS,
    restartRequired,
    warning: SYSTEM_WARNING,
  };
};

/** GET /api/settings/system */
exports.getSystemSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await describeSystem() });
});

/**
 * PUT /api/settings/system  { MONGO_URI?, JWT_SECRET?, JWT_EXPIRES_IN?, PORT?, CLIENT_URL? }
 * Writes the .env file only. Masked values (containing "****") sent back
 * unchanged from the GET response are ignored.
 */
exports.updateSystemSettings = asyncHandler(async (req, res) => {
  // In Docker the settings come from docker-compose, not from a .env file inside the container
  if (process.env.RUNNING_IN_DOCKER) {
    throw new AppError(
      'This server runs in Docker. Change these settings in backend/.env (and the .env next to docker-compose.yml) on the server, then run "docker compose up -d".',
      400
    );
  }
  const updates = {};
  EDITABLE_ENV_KEYS.forEach((key) => {
    const raw = req.body[key];
    if (raw === undefined || raw === null || raw === '') return;
    const value = String(raw).trim();
    if (value.includes('****')) return; // untouched masked value
    updates[key] = value;
  });

  if (!Object.keys(updates).length) {
    throw new AppError('Nothing to update. Enter a new value for at least one setting.', 400);
  }

  await updateEnvFile(updates);
  console.warn(`[system] .env updated by "${req.admin.username}": ${Object.keys(updates).join(', ')} (restart required)`);

  res.json({
    success: true,
    message: 'Restart server to apply',
    warning: SYSTEM_WARNING,
    data: { updatedKeys: Object.keys(updates), ...(await describeSystem()), restartRequired: true },
  });
});

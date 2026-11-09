/**
 * Central error handling.
 *
 * Every error ends up here and is returned as clean JSON:
 *   { "success": false, "message": "...", "errors": [ { field, message } ] }
 * Stack traces are only included for 5xx errors in development.
 */
const multer = require('multer');
const AppError = require('../utils/AppError');
const { cleanupRequestFiles } = require('../utils/fileHelpers');
const { MAX_UPLOAD_MB } = require('./upload');

/** 404 for unknown routes */
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

/** Translate known library errors into friendly status codes/messages. */
const normalizeError = (err) => {
  // Our own errors
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, errors: err.errors };
  }

  // Upload errors
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `Image is too large. Maximum size is ${MAX_UPLOAD_MB} MB.`,
      LIMIT_FILE_COUNT: 'Too many files uploaded at once.',
      LIMIT_UNEXPECTED_FILE: `Unexpected file field "${err.field}".`,
    };
    return { statusCode: 400, message: messages[err.code] || err.message };
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return { statusCode: 400, message: errors[0] ? errors[0].message : 'Validation failed', errors };
  }

  // Bad ObjectId or wrong type in a query
  if (err.name === 'CastError') {
    return { statusCode: 400, message: `Invalid value for "${err.path}"` };
  }

  // Unique index violation
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
    return { statusCode: 409, message: field ? `${field} already exists` : 'Duplicate value' };
  }

  // JWT errors (normally handled in auth middleware)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Invalid or expired token. Please log in again.' };
  }

  // Body parser errors
  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Invalid JSON in request body' };
  }
  if (err.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Request body is too large' };
  }

  return { statusCode: err.statusCode || err.status || 500, message: err.message || 'Internal server error' };
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Remove any images uploaded as part of the failed request
  cleanupRequestFiles(req).catch(() => {});

  if (res.headersSent) return next(err);

  const { statusCode, message, errors } = normalizeError(err);
  const isDev = process.env.NODE_ENV !== 'production';

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = {
    success: false,
    // Hide internal details of unexpected errors in production
    message: statusCode >= 500 && !isDev ? 'Internal server error' : message,
  };
  if (errors && errors.length) body.errors = errors;
  if (statusCode >= 500 && isDev) body.stack = err.stack;

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };

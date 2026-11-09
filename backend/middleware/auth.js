/**
 * JWT authentication for admin routes and admin Socket.io connections.
 */
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verify a JWT and return the matching admin document.
 * Shared by the HTTP middleware below and the Socket.io handshake.
 * Throws AppError(401) for missing, invalid or expired tokens.
 */
const verifyToken = async (token) => {
  if (!token) throw new AppError('Not authorized. Please log in.', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid token. Please log in again.';
    throw new AppError(message, 401);
  }

  const admin = await Admin.findById(decoded.id).select('+passwordChangedAt');
  if (!admin) throw new AppError('Admin account no longer exists. Please log in again.', 401);
  if (admin.changedPasswordAfter(decoded.iat)) {
    throw new AppError('Password was changed. Please log in again.', 401);
  }
  return admin;
};

/** Express middleware: requires "Authorization: Bearer <token>" and sets req.admin. */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  req.admin = await verifyToken(token);
  next();
});

module.exports = { protect, verifyToken };

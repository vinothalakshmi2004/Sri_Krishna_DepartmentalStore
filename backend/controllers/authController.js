/**
 * Admin authentication: login, profile, password and username changes.
 */
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * JWT_EXPIRES_IN accepts "7d", "12h", "30m" ... A bare number is treated as
 * seconds (jsonwebtoken would read the string "3600" as 3600 milliseconds).
 */
const getExpiresIn = () => {
  const value = (process.env.JWT_EXPIRES_IN || '7d').trim();
  return /^\d+$/.test(value) ? Number(value) : value;
};

const signToken = (admin) =>
  jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET, { expiresIn: getExpiresIn() });

/** POST /api/auth/login  { username, password } */
exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username: username.toLowerCase() }).select('+password');
  // Same message for unknown user and wrong password (no user enumeration)
  if (!admin || !(await admin.comparePassword(password))) {
    throw new AppError('Invalid username or password', 401);
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: { token: signToken(admin), expiresIn: getExpiresIn(), admin },
  });
});

/** GET /api/auth/me */
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.admin });
});

/**
 * PUT /api/auth/change-password  { oldPassword, newPassword }
 * Older tokens stop working; a fresh token is returned so this session continues.
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!admin) throw new AppError('Admin not found', 404);

  if (!(await admin.comparePassword(oldPassword))) {
    throw new AppError('Old password is incorrect', 400, [{ field: 'oldPassword', message: 'Old password is incorrect' }]);
  }
  if (oldPassword === newPassword) {
    throw new AppError('New password must be different from the old password', 400);
  }

  admin.password = newPassword; // hashed by the pre-save hook
  await admin.save();

  res.json({
    success: true,
    message: 'Password changed successfully',
    data: { token: signToken(admin), expiresIn: getExpiresIn() },
  });
});

/** PUT /api/auth/change-username  { username, name? } */
exports.changeUsername = asyncHandler(async (req, res) => {
  const { username, name } = req.body;

  const taken = await Admin.exists({ username, _id: { $ne: req.admin._id } });
  if (taken) throw new AppError('This username is already taken', 409);

  const admin = await Admin.findById(req.admin._id);
  if (!admin) throw new AppError('Admin not found', 404);

  admin.username = username;
  if (name !== undefined) admin.name = name;
  await admin.save();

  res.json({ success: true, message: 'Username updated successfully', data: admin });
});

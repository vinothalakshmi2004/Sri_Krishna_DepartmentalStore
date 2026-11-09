/**
 * Admin authentication routes.
 * Base path: /api/auth
 */
const express = require('express');
const { body } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Slow down password guessing: 10 failed logins per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

router.post(
  '/login',
  loginLimiter,
  [
    body('username').isString().withMessage('Username is required').bail()
      .trim().notEmpty().withMessage('Username is required'),
    body('password').isString().withMessage('Password is required').bail()
      .notEmpty().withMessage('Password is required'),
  ],
  validate,
  ctrl.login
);

router.get('/me', protect, ctrl.getMe);

router.put(
  '/change-password',
  protect,
  [
    body('oldPassword').isString().withMessage('Old password is required').bail()
      .notEmpty().withMessage('Old password is required'),
    body('newPassword').isString().withMessage('New password is required').bail()
      .isLength({ min: 6, max: 128 }).withMessage('New password must be 6 to 128 characters'),
  ],
  validate,
  ctrl.changePassword
);

router.put(
  '/change-username',
  protect,
  [
    body('username').isString().withMessage('Username is required').bail()
      .trim().toLowerCase()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3 to 30 characters')
      .matches(/^[a-z0-9_.-]+$/).withMessage('Username may only contain letters, numbers, dot, dash and underscore'),
    body('name').optional({ values: 'null' })
      .isString().withMessage('Invalid name').bail()
      .trim().isLength({ min: 1, max: 60 }).withMessage('Name must be 1 to 60 characters'),
  ],
  validate,
  ctrl.changeUsername
);

module.exports = router;

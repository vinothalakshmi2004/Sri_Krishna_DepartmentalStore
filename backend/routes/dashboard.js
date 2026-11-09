/**
 * Dashboard routes (admin only).
 * Base path: /api/dashboard
 */
const express = require('express');
const { query } = require('express-validator');
const ctrl = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { validate, dateRangeRules } = require('../middleware/validate');

const router = express.Router();
router.use(protect);

router.get(
  '/stats',
  [
    query('range').optional({ values: 'falsy' })
      .isIn(['today', 'week', 'month', 'custom']).withMessage('range must be today, week, month or custom'),
    ...dateRangeRules,
  ],
  validate,
  ctrl.getStats
);

module.exports = router;

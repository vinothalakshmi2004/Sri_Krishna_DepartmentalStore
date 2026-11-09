/**
 * Customer routes (admin only) - customers are aggregated from orders.
 * Base path: /api/customers
 */
const express = require('express');
const { param } = require('express-validator');
const ctrl = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { validate, paginationRules, searchRule } = require('../middleware/validate');
const { normalizePhone } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

router.get('/', [searchRule, ...paginationRules], validate, ctrl.getCustomers);

router.get(
  '/:phone',
  param('phone').customSanitizer(normalizePhone).matches(/^\d{10}$/).withMessage('Invalid phone number'),
  validate,
  ctrl.getCustomer
);

module.exports = router;

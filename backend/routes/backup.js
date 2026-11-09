/**
 * Database backup downloads (admin only).
 * Base path: /api/backup
 */
const express = require('express');
const ctrl = require('../controllers/backupController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/summary', ctrl.getSummary);
router.get('/data', ctrl.downloadData);
router.get('/structure', ctrl.downloadStructure);

module.exports = router;

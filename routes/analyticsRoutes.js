const express = require('express');
const router = express.Router();
const { getAdminStats } = require('../controllers/analyticsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/admin', protect, admin, getAdminStats);

module.exports = router;

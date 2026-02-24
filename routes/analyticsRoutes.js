const express = require('express');
const router = express.Router();
const { getAdminStats, getEmployeeStats } = require('../controllers/analyticsController');
const { protect, admin, employee } = require('../middleware/authMiddleware');

router.get('/admin', protect, admin, getAdminStats);
router.get('/employee', protect, employee, getEmployeeStats);

module.exports = router;

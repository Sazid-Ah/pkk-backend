const express = require('express');
const router = express.Router();
const {
    getAllActivityLogs,
    getUserActivityLogs,
    getActivityStats,
    getOnlineUsers,
    getSessionDetails
} = require('../controllers/activityLogController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get all activity logs (Admin only)
router.get('/', protect, admin, getAllActivityLogs);

// Get activity statistics (Admin only)
router.get('/stats', protect, admin, getActivityStats);

// Get online users (Admin only)
router.get('/online-users', protect, admin, getOnlineUsers);

// Get session details (Admin only)
router.get('/session/:sessionId', protect, admin, getSessionDetails);

// Get activity logs for a specific user
// Users can fetch their own logs; admins can fetch any user's logs
// Authorization enforced in controller
router.get('/user/:userId', protect, getUserActivityLogs);

module.exports = router;

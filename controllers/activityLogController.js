const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');
const crypto = require('crypto');

// @desc    Log an activity (login, logout, online, offline)
// @route   Internal function
// @access  Private
const logActivity = asyncHandler(async (userId, userType, username, email, role, activityType, ipAddress, userAgent, device, sessionId = null, details = null) => {
    const activity = await ActivityLog.create({
        userId,
        userType,
        username,
        email,
        role,
        activityType,
        ipAddress: ipAddress || '',
        userAgent: userAgent || '',
        device,
        sessionId: sessionId || crypto.randomBytes(16).toString('hex'),
        details,
        timestamp: new Date()
    });
    return activity;
});

// @desc    Get all activity logs (Admin only)
// @route   GET /api/activity-logs
// @access  Private/Admin
const getAllActivityLogs = asyncHandler(async (req, res) => {
    const {
        activityType,
        userType,
        startDate,
        endDate,
        username,
        role,
        page = 1,
        limit = 50
    } = req.query;

    // Build filter object
    const filter = {};

    if (activityType) {
        filter.activityType = activityType;
    }

    if (userType) {
        filter.userType = userType;
    }

    if (username) {
        filter.username = { $regex: username, $options: 'i' };
    }

    if (role) {
        filter.role = role;
    }

    // Date range filter
    if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) {
            filter.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.timestamp.$lte = end;
        }
    }

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;
    const skip = (pageNum - 1) * pageSize;

    // Get total count for pagination info
    const total = await ActivityLog.countDocuments(filter);

    // Fetch logs
    const logs = await ActivityLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(pageSize)
        .skip(skip)
        .lean();

    res.status(200).json({
        success: true,
        count: logs.length,
        total,
        pages: Math.ceil(total / pageSize),
        currentPage: pageNum,
        data: logs
    });
});

// @desc    Get activity logs for a specific user
// @route   GET /api/activity-logs/user/:userId
// @access  Private — users can only see own logs; admins can see any
const getUserActivityLogs = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { activityType, page = 1, limit = 50 } = req.query;

    // Authorization: non-admin users can only view their own activity logs
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
        res.status(403);
        throw new Error('Not authorized to view another user\'s activity logs');
    }

    const filter = { userId };

    if (activityType) {
        filter.activityType = activityType;
    }

    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;
    const skip = (pageNum - 1) * pageSize;

    const total = await ActivityLog.countDocuments(filter);

    const logs = await ActivityLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(pageSize)
        .skip(skip)
        .lean();

    res.status(200).json({
        success: true,
        count: logs.length,
        total,
        pages: Math.ceil(total / pageSize),
        currentPage: pageNum,
        data: logs
    });
});

// @desc    Get activity statistics
// @route   GET /api/activity-logs/stats
// @access  Private/Admin
const getActivityStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) {
            filter.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.timestamp.$lte = end;
        }
    }

    // Stats by activity type
    const byActivityType = await ActivityLog.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$activityType',
                count: { $sum: 1 }
            }
        }
    ]);

    // Stats by user type
    const byUserType = await ActivityLog.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$userType',
                count: { $sum: 1 }
            }
        }
    ]);

    // Stats by role
    const byRole = await ActivityLog.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get current online users
    const onlineUsers = await ActivityLog.aggregate([
        {
            $match: {
                activityType: 'online',
                $expr: {
                    $gte: [
                        '$timestamp',
                        { $subtract: [new Date(), 24 * 60 * 60 * 1000] } // Last 24 hours
                    ]
                }
            }
        },
        {
            $group: {
                _id: '$userId',
                lastActivity: { $max: '$timestamp' }
            }
        },
        {
            $count: 'total'
        }
    ]);

    // Get unique users active today
    const activeUsersToday = await ActivityLog.aggregate([
        {
            $match: {
                timestamp: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        },
        {
            $group: {
                _id: '$userId'
            }
        },
        {
            $count: 'total'
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            byActivityType: byActivityType.length > 0 ? byActivityType : [],
            byUserType: byUserType.length > 0 ? byUserType : [],
            byRole: byRole.length > 0 ? byRole : [],
            onlineUsersCount: onlineUsers.length > 0 ? onlineUsers[0].total : 0,
            activeUsersTodayCount: activeUsersToday.length > 0 ? activeUsersToday[0].total : 0
        }
    });
});

// @desc    Get online users
// @route   GET /api/activity-logs/online-users
// @access  Private/Admin
const getOnlineUsers = asyncHandler(async (req, res) => {
    const { userType, role } = req.query;

    const filter = {
        activityType: 'online',
        timestamp: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
    };

    if (userType) {
        filter.userType = userType;
    }

    if (role) {
        filter.role = role;
    }

    // Get the most recent 'online' activity for each user
    const onlineUsers = await ActivityLog.aggregate([
        { $match: filter },
        {
            $sort: { timestamp: -1 }
        },
        {
            $group: {
                _id: '$userId',
                username: { $first: '$username' },
                email: { $first: '$email' },
                role: { $first: '$role' },
                userType: { $first: '$userType' },
                lastActivityTime: { $first: '$timestamp' },
                device: { $first: '$device' }
            }
        },
        {
            $sort: { lastActivityTime: -1 }
        }
    ]);

    res.status(200).json({
        success: true,
        count: onlineUsers.length,
        data: onlineUsers
    });
});

// @desc    Get session details (login to logout)
// @route   GET /api/activity-logs/session/:sessionId
// @access  Private/Admin
const getSessionDetails = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const sessionLogs = await ActivityLog.find({ sessionId })
        .sort({ timestamp: 1 })
        .lean();

    if (sessionLogs.length === 0) {
        res.status(404);
        throw new Error('Session not found');
    }

    const loginLog = sessionLogs.find(log => log.activityType === 'login');
    const logoutLog = sessionLogs.find(log => log.activityType === 'logout');

    let sessionDuration = null;
    if (loginLog && logoutLog) {
        sessionDuration = (logoutLog.timestamp - loginLog.timestamp) / 1000 / 60; // in minutes
    }

    res.status(200).json({
        success: true,
        data: {
            sessionId,
            userId: sessionLogs[0].userId,
            username: sessionLogs[0].username,
            userType: sessionLogs[0].userType,
            loginTime: loginLog?.timestamp,
            logoutTime: logoutLog?.timestamp,
            sessionDurationMinutes: sessionDuration,
            device: sessionLogs[0].device,
            ipAddress: sessionLogs[0].ipAddress,
            activities: sessionLogs
        }
    });
});

module.exports = {
    logActivity,
    getAllActivityLogs,
    getUserActivityLogs,
    getActivityStats,
    getOnlineUsers,
    getSessionDetails
};

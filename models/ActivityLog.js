const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    userType: {
        type: String,
        enum: ['User', 'Employee', 'Pandit'],
        required: true
    },
    username: {
        type: String,
        required: true,
        index: true
    },
    email: {
        type: String,
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'employee', 'staff', 'pandit'],
        required: true
    },
    activityType: {
        type: String,
        enum: ['login', 'logout', 'online', 'offline', 'registration'],
        required: true,
        index: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    device: {
        type: String,
        enum: ['Mobile', 'Desktop'],
        default: 'Desktop'
    },
    sessionId: {
        type: String,
        index: true
    },
    details: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Composite index for efficient queries
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ activityType: 1, timestamp: -1 });
activityLogSchema.index({ userType: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

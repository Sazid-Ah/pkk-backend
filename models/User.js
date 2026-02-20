const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'employee'],
        default: 'user',
    },
    otp: {
        type: String,
    },
    otpExpiry: {
        type: Date,
    },
    resetToken: {
        type: String,
    },
    refreshToken: {
        type: String,
    },
    phoneNumber: {
        type: String,
        trim: true,
    },
    avatar: {
        type: String, // URL to image
        default: '',
    },
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        device: String
    }],
    isOnline: {
        type: Boolean,
        default: false,
        index: true
    },
    lastActiveAt: {
        type: Date,
        default: null
    },
    addresses: [{
        street: String,
        city: String,
        state: String,
        zip: String,
        label: {
            type: String,
            enum: ['Home', 'Office', 'Other'],
            default: 'Home'
        },
        country: { type: String, default: 'India' },
        isDefault: { type: Boolean, default: false }
    }],
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);

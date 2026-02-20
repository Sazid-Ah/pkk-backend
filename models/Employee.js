const mongoose = require('mongoose');

const employeeSchema = mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
    },
    role: {
        type: String,
        enum: ['admin', 'employee'],
        default: 'employee',
    },
    fullName: {
        type: String,
        required: [true, 'Please add a full name']
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number']
    },
    position: {
        type: String,
        default: 'Staff'
    },
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zip: { type: String, default: '' },
        country: { type: String, default: 'India' }
    },
    location: {
        type: String,
        default: ''
    },
    salary: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false,
        index: true
    },
    lastActiveAt: {
        type: Date,
        default: null
    },
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        device: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);

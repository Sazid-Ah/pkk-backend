const mongoose = require('mongoose');

const employeeSchema = mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true,
        trim: true,
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
        type: String
    },
    salary: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
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

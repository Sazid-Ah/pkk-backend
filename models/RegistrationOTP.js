const mongoose = require('mongoose');

const registrationOTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    otp: {
        type: String,
        required: true,
    },
    otpExpiry: {
        type: Date,
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Set auto-expire after 10 minutes from creation if not handled manually
registrationOTPSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('RegistrationOTP', registrationOTPSchema);

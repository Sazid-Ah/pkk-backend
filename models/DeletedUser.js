const mongoose = require('mongoose');

const deletedUserSchema = new mongoose.Schema(
    {
        originalUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        username: {
            type: String,
        },
        fullName: {
            type: String,
        },
        email: {
            type: String,
            lowercase: true,
        },
        role: {
            type: String,
        },
        phoneNumber: {
            type: String,
        },
        avatar: {
            type: String,
        },
        userSnapshot: {
            type: mongoose.Schema.Types.Mixed,
        },
        deletedAt: {
            type: Date,
            default: Date.now,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        reason: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('DeletedUser', deletedUserSchema);

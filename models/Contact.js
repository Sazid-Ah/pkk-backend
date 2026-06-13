const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        subject: {
            type: String,
            required: [true, 'Please add a subject'],
            trim: true,
        },
        message: {
            type: String,
            required: [true, 'Please add a message'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['new', 'read', 'replied', 'archived'],
            default: 'new',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Contact', contactSchema);

const mongoose = require('mongoose');

// Applications from people who want to join as pandits — reviewed by admins.
const panditApplicationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: '' },
    specialty: { type: String, trim: true, default: '' },
    experience: { type: Number, default: 0 },
    bio: { type: String, trim: true, default: '' },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('PanditApplication', panditApplicationSchema);

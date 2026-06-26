const mongoose = require('mongoose');

const { generateTranslations } = require('../utils/translateUtils');

console.log('Loading Pandit model...');

const panditSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
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
    },
    role: {
        type: String,
        default: 'pandit',
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
    }],
    specialty: {
        type: String,
        required: [true, 'Please add a specialty'],
    },
    languages: [{
        type: String,
        trim: true,
    }],
    about: {
        type: String,
        trim: true,
        default: '',
    },
    // Displayed aggregate = blend of the admin seed and real user reviews.
    rating: {
        type: Number,
        default: 0,
    },
    numReviews: {
        type: Number,
        default: 0,
    },
    // Admin-set initial rating (seed) that user reviews blend into.
    seedRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
    },
    seedReviews: {
        type: Number,
        default: 0,
    },
    price: {
        type: String, // Can be range like "₹2000-5000" or fixed amount
        required: [true, 'Please add price info'],
    },
    priceMin: {
        type: Number,
        default: null,
    },
    priceMax: {
        type: Number,
        default: null,
    },
    // Compare-at / original price for display. Set only when on sale (mrp > priceMin).
    mrp: {
        type: Number,
        min: [0, 'MRP cannot be negative'],
        default: null,
    },
    image: {
        type: String,
        default: '', // URL to image
    },
    address: {
        type: String,
        default: '',
    },
    // Indian state the pandit serves in. Used to show a client only the pandits
    // in their (selected/detected) state. Stored as the canonical state name.
    state: {
        type: String,
        trim: true,
        default: '',
        index: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    experience: {
        type: Number,
        default: 0,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    occasions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Occasion'
    }],
    // Per-occasion pricing. Source of truth for what a pandit charges: each
    // occasion (service) carries its own price, and two pandits can price the
    // same occasion differently. `occasions`, `price`, `priceMin`, `priceMax`
    // are derived from this in the controller for backward-compatible display,
    // sorting and `?occasionId` filtering.
    services: [{
        occasion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Occasion',
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: [0, 'Service price cannot be negative'],
        },
        // Optional compare-at / original price for a per-service discount badge.
        mrp: {
            type: Number,
            min: [0, 'MRP cannot be negative'],
            default: null,
        },
    }],
    translations: {
        type: Object,
        default: {}
    },
    refreshToken: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

panditSchema.index({ location: '2dsphere' });


// Mongoose 9 middleware is promise/async style — no `next` callback.
panditSchema.pre('save', async function () {
    if ((this.isNew || this.isModified('specialty') || this.isModified('about')) &&
        (!this.translations || Object.keys(this.translations).length === 0)) {
        try {
            this.translations = await generateTranslations({
                specialty: this.specialty || '',
                about: this.about || '',
            });
        } catch (e) {
            // non-fatal — translations can be populated later via script
        }
    }
});

console.log('✓ Pandit model schema defined');

try {
    module.exports = mongoose.model('Pandit', panditSchema);
    console.log('✓ Pandit model exported');
} catch (error) {
    console.error('❌ Error exporting Pandit model:', error.message);
    throw error;
}

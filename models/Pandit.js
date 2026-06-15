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
    rating: {
        type: Number,
        default: 0,
    },
    numReviews: {
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
    image: {
        type: String,
        default: '', // URL to image
    },
    address: {
        type: String,
        default: '',
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


panditSchema.pre('save', function (next) {
    if ((this.isNew || this.isModified('specialty') || this.isModified('about')) &&
        (!this.translations || Object.keys(this.translations).length === 0)) {
        generateTranslations({
            specialty: this.specialty || '',
            about: this.about || '',
        })
        .then(translations => {
            this.translations = translations;
            next();
        })
        .catch(e => {
            next();
        });
    } else {
        next();
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

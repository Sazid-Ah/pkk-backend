const mongoose = require('mongoose');

const panditSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
    },
    specialty: {
        type: String,
        required: [true, 'Please add a specialty'],
    },
    rating: {
        type: Number,
        default: 0,
    },
    price: {
        type: String, // Can be range like "₹2000-5000" or fixed amount
        required: [true, 'Please add price info'],
    },
    image: {
        type: String,
        default: '', // URL to image
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    occasions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Occasion'
    }],
    // Geolocation fields
    location: {
        address: {
            type: String,
            trim: true,
        },
        street: String,
        city: String,
        state: String,
        zip: String,
        landmark: String,
        country: {
            type: String,
            default: 'India'
        },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0]
            }
        }
    },
    // Service area
    availableRadius: {
        type: Number, // in kilometers
        default: 15,
        min: 1,
        max: 100
    },
    // Additional details
    experience: {
        type: Number, // years of experience
        default: 1
    },
    bio: String,
    languages: [String],
    specializations: [String],
    phone: String,
    isVerified: {
        type: Boolean,
        default: false
    },
    totalBookings: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
});

// Create geospatial index for location-based queries
panditSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Pandit', panditSchema);

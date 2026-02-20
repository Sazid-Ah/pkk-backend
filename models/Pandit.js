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
    isFeatured: {
        type: Boolean,
        default: false,
    },
    occasions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Occasion'
    }]
}, {
    timestamps: true,
});

panditSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Pandit', panditSchema);

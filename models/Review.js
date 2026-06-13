const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemType: {
        type: String,
        enum: ['Pandit', 'Product'],
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        // Dynamic reference not strictly needed if we query manually, but good practice
        refPath: 'itemType'
    },
    rating: {
        type: Number,
        required: [true, 'Please provide a rating'],
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        maxlength: 500
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    }
}, {
    timestamps: true
});

// Prevent user from submitting multiple reviews for the same item 
// (though our logic should handle this per booking/order)
reviewSchema.index({ user: 1, itemId: 1, bookingId: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

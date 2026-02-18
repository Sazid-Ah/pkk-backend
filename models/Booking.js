const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    pandit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pandit',
        required: true,
    },
    bookingDate: {
        type: Date,
        required: [true, 'Please select a date'],
    },
    timeSlot: {
        type: String,
        required: [true, 'Please select a time slot'],
    },
    occasion: {
        type: String,
        required: [true, 'Please specify the occasion'],
    },
    price: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
        default: 'Pending',
    },
    notes: {
        type: String,
    },
    address: { // Address where puja will happen
        street: String,
        city: String,
        state: String,
        zip: String,
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Booking', bookingSchema);

const mongoose = require('mongoose');
const { makeInvoiceNumber } = require('../utils/invoiceNumber');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    invoiceNumber: {
        type: String,
        index: true,
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
    // Base service fee is `price`; 18% GST is added on top (aligns with order-services).
    gstPercentage: {
        type: Number,
        default: 18,
    },
    gstAmount: {
        type: Number,
        default: 0,
    },
    totalAmount: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
        default: 'Pending',
    },
    notes: {
        type: String,
    },
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
    },
    paymentMethod: {
        type: String,
        enum: ['Online', 'PayAfterService'],
        default: 'PayAfterService',
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending',
    },
    isRated: {
        type: Boolean,
        default: false,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    occasionRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Occasion',
        default: null,
    },
}, {
    timestamps: true,
});

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ pandit: 1, bookingDate: -1 });
// Prevent double-booking: only one active booking per pandit/date/slot
bookingSchema.index(
    { pandit: 1, bookingDate: 1, timeSlot: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $in: ['Pending', 'Confirmed'] } },
        name: 'unique_active_slot',
    }
);

// Stamp a stable invoice number on first save (persistent record of the booking).
bookingSchema.pre('save', function (next) {
    if (!this.invoiceNumber) {
        this.invoiceNumber = makeInvoiceNumber('BK', this._id, this.createdAt);
    }
    next();
});

module.exports = mongoose.model('Booking', bookingSchema);

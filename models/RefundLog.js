const mongoose = require('mongoose');

const refundLogSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null,
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
    },
    razorpayPaymentId: {
        type: String,
        required: true,
    },
    razorpayRefundId: {
        type: String,
        default: '',
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    failureReason: {
        type: String,
        default: '',
    },
    retryCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('RefundLog', refundLogSchema);

const mongoose = require('mongoose');
const { makeInvoiceNumber } = require('../utils/invoiceNumber');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    invoiceNumber: {
        type: String,
        index: true,
    },
    items: [{
        originalId: { type: mongoose.Schema.Types.ObjectId }, // ID of product or pandit
        name: { type: String, required: true },
        translations: { type: Object, default: {} },
        type: { type: String, enum: ['product', 'pandit'], required: true },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true },
        image: { type: String, default: '' },
        isRated: {
            type: Boolean,
            default: false,
        },
    }],
    totalAmount: {
        type: Number,
        required: true,
    },
    discountAmount: {
        type: Number,
        default: 0,
    },
    discountPercentage: {
        type: Number,
        default: 0,
    },
    gstAmount: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Completed', 'Cancelled'],
        default: 'Pending',
    },
    shippingAddress: {
        label:    { type: String, default: '' },
        street:   { type: String, default: '' },
        city:     { type: String, default: '' },
        state:    { type: String, default: '' },
        zip:      { type: String, default: '' },
        country:  { type: String, default: 'India' },
        landmark: { type: String, default: '' },
        isGPS:    { type: Boolean, default: false },
    },
    razorpayOrderId: {
        type: String,
    },
    razorpayPaymentId: {
        type: String,
    },
    razorpaySignature: {
        type: String,
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending',
    },
    paymentMethod: {
        type: String,
        enum: ['Razorpay', 'CashOnDelivery'],
        default: 'Razorpay',
    },
}, {
    timestamps: true,
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Stamp a stable invoice number on first save (a persistent record of the purchase).
orderSchema.pre('save', function (next) {
    if (!this.invoiceNumber) {
        this.invoiceNumber = makeInvoiceNumber('ORD', this._id, this.createdAt);
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);

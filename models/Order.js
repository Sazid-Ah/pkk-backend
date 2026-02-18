const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    items: [{
        originalId: { type: mongoose.Schema.Types.ObjectId }, // ID of product or pandit
        name: { type: String, required: true },
        type: { type: String, enum: ['product', 'pandit'], required: true },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true },
    }],
    totalAmount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
        default: 'Pending',
    },
    shippingAddress: {
        type: String, // Simple string for now
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);

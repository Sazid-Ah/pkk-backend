const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true,
    },
    category: {
        type: String,
        required: [true, 'Please add a category'],
    },
    price: {
        type: Number,
        required: [true, 'Please add a price'],
    },
    image: {
        type: String,
        default: '', // URL to image
    },
    description: {
        type: String,
    },
    weight: {
        type: String, // e.g. "500g", "1kg"
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Product', productSchema);

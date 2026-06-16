const mongoose = require('mongoose');
const { generateTranslations } = require('../utils/translateUtils');

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
    // Compare-at / original price for display. Set only when the item is on sale
    // (mrp > price). `price` always remains the amount actually charged.
    mrp: {
        type: Number,
        min: [0, 'MRP cannot be negative'],
        default: null,
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
    },
    type: {
        type: String,
        enum: ['individual', 'package'],
        default: 'individual',
    },
    includedItems: [{
        name: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        }
    }],
    occasions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Occasion'
    }],
    gstPercentage: {
        type: Number,
        default: 0,
        min: [0, 'GST percentage cannot be negative'],
        max: [100, 'GST percentage cannot exceed 100']
    },
    translations: {
        type: Object,
        default: {}
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
    },
    numReviews: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
});

productSchema.pre('save', async function () {
    if ((this.isNew || this.isModified('name') || this.isModified('description')) &&
        (!this.translations || Object.keys(this.translations).length === 0)) {
        try {
            this.translations = await generateTranslations({
                name: this.name,
                description: this.description || '',
            });
        } catch (e) {
            // non-fatal — translations can be populated later via script
        }
    }
});

module.exports = mongoose.model('Product', productSchema);

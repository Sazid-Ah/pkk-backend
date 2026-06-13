const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
    discountPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    isDiscountActive: {
        type: Boolean,
        default: false,
    },
    discountCardTitle: {
        type: Map,
        of: String,
        default: {
            en: 'Special Discount',
            hi: 'विशेष छूट',
        }
    },
    discountCardDescription: {
        type: Map,
        of: String,
        default: {
            en: 'Enjoy a special discount on your purchase!',
            hi: 'अपनी खरीदारी पर विशेष छूट का आनंद लें!',
        }
    },
    // You can add more global settings here in the future
}, {
    timestamps: true,
});

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);

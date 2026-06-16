const mongoose = require('mongoose');

// Admin-curated promotional banner shown on the customer homepage.
// Multiple active promotions render as a carousel; one renders as a single banner.
const promotionSchema = new mongoose.Schema({
    // Multilingual content (same Map<String> pattern as GlobalSettings)
    title: {
        type: Map,
        of: String,
        default: { en: '' },
    },
    subtitle: {
        type: Map,
        of: String,
        default: { en: '' },
    },
    image: { type: String, default: '' },          // optional banner image URL
    badge: { type: String, default: '' },           // small eyebrow label, e.g. "Limited offer"
    ctaText: { type: String, default: '' },          // button label, e.g. "Shop deals"
    // Where the CTA takes the customer
    linkType: {
        type: String,
        enum: ['none', 'url', 'product', 'pandit', 'occasion', 'browse-products', 'browse-pandits'],
        default: 'none',
    },
    linkUrl: { type: String, default: '' },          // used when linkType === 'url'
    linkRef: { type: mongoose.Schema.Types.ObjectId, default: null }, // product/pandit/occasion id
    // Visual preset resolved to a gradient on the frontend
    theme: {
        type: String,
        enum: ['navy', 'orange', 'dark', 'light', 'emerald'],
        default: 'navy',
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },          // optional scheduling window
    endsAt: { type: Date, default: null },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Promotion', promotionSchema);

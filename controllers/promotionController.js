const asyncHandler = require('express-async-handler');
const Promotion = require('../models/Promotion');
const { generateTranslations } = require('../utils/translateUtils');

// Build multilingual maps for title/subtitle, auto-translating from English when asked.
async function buildLocalizedContent(title, subtitle, autoTranslate) {
    const titleMap = { ...(title || {}) };
    const subtitleMap = { ...(subtitle || {}) };

    if (autoTranslate && titleMap.en) {
        const translations = await generateTranslations({
            title: titleMap.en,
            subtitle: subtitleMap.en || '',
        });
        Object.keys(translations).forEach((lang) => {
            if (translations[lang].title) titleMap[lang] = translations[lang].title;
            if (translations[lang].subtitle) subtitleMap[lang] = translations[lang].subtitle;
        });
    }
    return { titleMap, subtitleMap };
}

const mapToObject = (m) => (m && typeof m.entries === 'function' ? Object.fromEntries(m) : (m || {}));

// @desc    Get currently-active promotions (within their schedule window)
// @route   GET /api/promotions
// @access  Public
const getActivePromotions = asyncHandler(async (req, res) => {
    const now = new Date();
    const promotions = await Promotion.find({
        isActive: true,
        $and: [
            { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
            { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
    }).sort({ sortOrder: 1, createdAt: -1 });
    res.json(promotions);
});

// @desc    Get all promotions (including inactive/expired) for management
// @route   GET /api/promotions/all
// @access  Private/Admin
const getAllPromotions = asyncHandler(async (req, res) => {
    const promotions = await Promotion.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json(promotions);
});

// @desc    Create a promotion
// @route   POST /api/promotions
// @access  Private/Admin
const createPromotion = asyncHandler(async (req, res) => {
    const {
        title, subtitle, discountPercentage, image, badge, ctaText, linkType, linkUrl, linkRef,
        theme, isActive, sortOrder, startsAt, endsAt, autoTranslate,
    } = req.body;

    const { titleMap, subtitleMap } = await buildLocalizedContent(title, subtitle, autoTranslate);

    const promotion = await Promotion.create({
        title: titleMap,
        subtitle: subtitleMap,
        discountPercentage: Math.min(100, Math.max(0, Number(discountPercentage) || 0)),
        image: image || '',
        badge: badge || '',
        ctaText: ctaText || '',
        linkType: linkType || 'none',
        linkUrl: linkUrl || '',
        linkRef: linkRef || null,
        theme: theme || 'navy',
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
    });

    res.status(201).json(promotion);
});

// @desc    Update a promotion
// @route   PUT /api/promotions/:id
// @access  Private/Admin
const updatePromotion = asyncHandler(async (req, res) => {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
        res.status(404);
        throw new Error('Promotion not found');
    }

    const {
        title, subtitle, discountPercentage, image, badge, ctaText, linkType, linkUrl, linkRef,
        theme, isActive, sortOrder, startsAt, endsAt, autoTranslate,
    } = req.body;

    if (discountPercentage !== undefined) {
        promotion.discountPercentage = Math.min(100, Math.max(0, Number(discountPercentage) || 0));
    }

    if (title !== undefined || subtitle !== undefined || autoTranslate) {
        const { titleMap, subtitleMap } = await buildLocalizedContent(
            title !== undefined ? title : mapToObject(promotion.title),
            subtitle !== undefined ? subtitle : mapToObject(promotion.subtitle),
            autoTranslate,
        );
        promotion.title = titleMap;
        promotion.subtitle = subtitleMap;
    }

    if (image !== undefined) promotion.image = image;
    if (badge !== undefined) promotion.badge = badge;
    if (ctaText !== undefined) promotion.ctaText = ctaText;
    if (linkType !== undefined) promotion.linkType = linkType;
    if (linkUrl !== undefined) promotion.linkUrl = linkUrl;
    if (linkRef !== undefined) promotion.linkRef = linkRef || null;
    if (theme !== undefined) promotion.theme = theme;
    if (isActive !== undefined) promotion.isActive = isActive;
    if (sortOrder !== undefined) promotion.sortOrder = sortOrder;
    if (startsAt !== undefined) promotion.startsAt = startsAt || null;
    if (endsAt !== undefined) promotion.endsAt = endsAt || null;

    const updated = await promotion.save();
    res.json(updated);
});

// @desc    Delete a promotion
// @route   DELETE /api/promotions/:id
// @access  Private/Admin
const deletePromotion = asyncHandler(async (req, res) => {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
        res.status(404);
        throw new Error('Promotion not found');
    }
    await promotion.deleteOne();
    res.json({ message: 'Promotion removed' });
});

module.exports = {
    getActivePromotions,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
};

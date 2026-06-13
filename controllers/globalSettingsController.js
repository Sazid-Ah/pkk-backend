const asyncHandler = require('express-async-handler');
const GlobalSettings = require('../models/GlobalSettings');

const { generateTranslations } = require('../utils/translateUtils');


// @desc    Get global settings
// @route   GET /api/global-settings
// @access  Public
const getGlobalSettings = asyncHandler(async (req, res) => {
    let settings = await GlobalSettings.findOne();
    
    if (!settings) {
        // Create default settings if none exist
        settings = await GlobalSettings.create({
            discountPercentage: 20, // Default to 20 as previously hardcoded
            isDiscountActive: true,
            discountCardTitle: {
                en: 'Special Discount',
                hi: 'विशेष छूट',
            },
            discountCardDescription: {
                en: 'Enjoy 20% off on all products for your first order!',
                hi: 'अपने पहले ऑर्डर पर सभी उत्पादों पर 20% की छूट का आनंद लें!',
            }
        });
    }
    
    res.json(settings);
});

// @desc    Update global settings
// @route   PUT /api/global-settings
// @access  Private/Admin
const updateGlobalSettings = asyncHandler(async (req, res) => {
    let settings = await GlobalSettings.findOne();
    
    if (!settings) {
        settings = new GlobalSettings();
    }
    
    const { 
        discountPercentage, 
        isDiscountActive, 
        discountCardTitle, 
        discountCardDescription,
        autoTranslate // Boolean flag from frontend
    } = req.body;

    if (discountPercentage !== undefined) settings.discountPercentage = discountPercentage;
    if (isDiscountActive !== undefined) settings.isDiscountActive = isDiscountActive;

    // Handle Translations
    if (autoTranslate && discountCardTitle && discountCardTitle.en) {
        // Auto-translate using English as source
        const fields = {
            title: discountCardTitle.en,
            description: discountCardDescription?.en || ''
        };
        const translations = await generateTranslations(fields);
        
        const titleMap = { en: fields.title };
        const descMap = { en: fields.description };
        
        Object.keys(translations).forEach(lang => {
            titleMap[lang] = translations[lang].title;
            descMap[lang] = translations[lang].description;
        });

        settings.discountCardTitle = titleMap;
        settings.discountCardDescription = descMap;
    } else {
        // Manual updates
        if (discountCardTitle !== undefined) settings.discountCardTitle = discountCardTitle;
        if (discountCardDescription !== undefined) settings.discountCardDescription = discountCardDescription;
    }

    
    const updatedSettings = await settings.save();
    res.json(updatedSettings);
});

module.exports = {
    getGlobalSettings,
    updateGlobalSettings,
};

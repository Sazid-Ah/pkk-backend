let translate;
try {
    translate = require('translate-google');
} catch (error) {
    console.warn('translate-google package not installed. Translations will be disabled.');
    translate = null;
}

const TARGET_LANGS = ['hi', 'bn', 'te', 'ta', 'kn'];
const TRANSLATE_TIMEOUT_MS = 5000;

function translateWithTimeout(text, lang) {
    return Promise.race([
        translate(text, { to: lang }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Translation timeout for lang: ${lang}`)), TRANSLATE_TIMEOUT_MS)
        ),
    ]);
}

async function generateTranslations(fieldsToTranslate) {
    if (!translate) {
        console.warn('Translate function not available');
        return {};
    }
    const translations = {};

    for (const lang of TARGET_LANGS) {
        translations[lang] = {};
    }

    try {
        for (const [fieldKey, fieldVal] of Object.entries(fieldsToTranslate)) {
            if (!fieldVal || typeof fieldVal !== 'string') continue;

            for (const lang of TARGET_LANGS) {
                try {
                    const res = await translateWithTimeout(fieldVal, lang);
                    translations[lang][fieldKey] = res;
                } catch (err) {
                    console.error(`Failed to translate '${fieldVal}' to ${lang}:`, err.message);
                    translations[lang][fieldKey] = fieldVal;
                }
            }
        }
    } catch (error) {
        console.error('Translation error:', error);
    }

    return translations;
}

module.exports = {
    generateTranslations,
    TARGET_LANGS
};

/**
 * One-time migration: auto-translates all Products, Occasions, Categories, and Pandits
 * into hi, bn, te, ta, kn and saves the translations field in MongoDB.
 *
 * Run: node scripts/populate_translations.js
 * Options:
 *   --model=product|occasion|category|pandit   (default: all)
 *   --force                                     re-translate even if translations exist
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/pkk';
const TARGET_LANGS = ['hi', 'bn', 'te', 'ta', 'kn'];

let translate;
try {
    translate = require('translate-google');
} catch (e) {
    console.error('translate-google not installed. Run: npm install translate-google');
    process.exit(1);
}

const args = process.argv.slice(2);
const modelArg = (args.find(a => a.startsWith('--model=')) || '').replace('--model=', '') || 'all';
const force = args.includes('--force');

async function translateFields(fields) {
    const result = {};
    for (const lang of TARGET_LANGS) result[lang] = {};

    for (const [key, val] of Object.entries(fields)) {
        if (!val || typeof val !== 'string') continue;
        for (const lang of TARGET_LANGS) {
            try {
                result[lang][key] = await translate(val, { to: lang });
                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 150));
            } catch (err) {
                console.warn(`  [warn] ${lang}/${key}: ${err.message}`);
                result[lang][key] = val;
            }
        }
    }
    return result;
}

async function processCollection(Model, docs, getFields, label) {
    console.log(`\n=== ${label} (${docs.length} records) ===`);
    let done = 0, skipped = 0;

    for (const doc of docs) {
        const hasTranslations = doc.translations && Object.keys(doc.translations).length > 0;
        if (hasTranslations && !force) {
            skipped++;
            continue;
        }

        const fields = getFields(doc);
        const nonEmpty = Object.values(fields).filter(v => v && v.trim());
        if (!nonEmpty.length) { skipped++; continue; }

        console.log(`  Translating: "${Object.values(fields).filter(Boolean).join(' | ')}"`);
        try {
            const translations = await translateFields(fields);
            doc.translations = translations;
            doc.markModified('translations');
            await doc.save();
            done++;
            console.log(`  ✓ Done (${done}/${docs.length - skipped})`);
        } catch (err) {
            console.error(`  ✗ Failed for ${doc._id}: ${err.message}`);
        }
    }

    console.log(`  Result: ${done} translated, ${skipped} skipped (already had translations)`);
}

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.\n');

    const run_ = (name) => !modelArg || modelArg === 'all' || modelArg === name;

    if (run_('product')) {
        const Product = require('../models/Product');
        const docs = await Product.find({});
        await processCollection(Product, docs, doc => ({
            name: doc.name,
            description: doc.description || '',
        }), 'Products');
    }

    if (run_('occasion')) {
        const Occasion = require('../models/Occasion');
        const docs = await Occasion.find({});
        await processCollection(Occasion, docs, doc => ({
            name: doc.name,
        }), 'Occasions');
    }

    if (run_('category')) {
        const Category = require('../models/Category');
        const docs = await Category.find({});
        await processCollection(Category, docs, doc => ({
            name: doc.name,
        }), 'Categories');
    }

    if (run_('pandit')) {
        const Pandit = require('../models/Pandit');
        const docs = await Pandit.find({});
        await processCollection(Pandit, docs, doc => ({
            specialty: doc.specialty || '',
            about: doc.about || '',
        }), 'Pandits');
    }

    console.log('\n✓ All done. Disconnecting...');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Fatal error:', err);
    mongoose.disconnect();
    process.exit(1);
});

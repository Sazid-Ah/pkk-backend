require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Pandit = require('./models/Pandit');
const Category = require('./models/Category');
const Occasion = require('./models/Occasion');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        console.log('Migrating Categories...');
        const categories = await Category.find({});
        for (const cat of categories) {
            cat.markModified('name');
            await cat.save();
        }

        console.log('Migrating Occasions...');
        const occasions = await Occasion.find({});
        for (const occ of occasions) {
            occ.markModified('name');
            if (occ.englishName) occ.markModified('englishName');
            await occ.save();
        }

        console.log('Migrating Products...');
        const products = await Product.find({});
        for (const prod of products) {
            prod.markModified('name');
            if (prod.description) prod.markModified('description');
            await prod.save();
        }

        console.log('Migrating Pandits...');
        const pandits = await Pandit.find({});
        for (const p of pandits) {
            p.markModified('name');
            if (p.specialty) p.markModified('specialty');
            if (p.about) p.markModified('about');
            await p.save();
        }

        console.log('Migration Complete!');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();

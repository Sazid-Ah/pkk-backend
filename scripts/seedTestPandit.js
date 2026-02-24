/**
 * Run: node scripts/seedTestPandit.js
 * Creates a test Pandit with login credentials for testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/pkk';

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const Pandit = require('../models/Pandit');

    const username = 'testpandit';
    const password = 'pandit123';

    // Check if already exists
    const existing = await Pandit.findOne({ username });
    if (existing) {
        console.log(`Pandit with username "${username}" already exists. Updating password and role...`);
        const salt = await bcrypt.genSalt(10);
        existing.password = await bcrypt.hash(password, salt);
        existing.role = 'pandit';
        await existing.save();
        console.log('Updated successfully.');
    } else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await Pandit.create({
            name: 'Test Pandit',
            username,
            password: hashedPassword,
            role: 'pandit',
            specialty: 'Puja',
            price: '₹2000',
            languages: ['Hindi'],
        });
        console.log('Test Pandit created successfully.');
    }

    console.log(`\n✅ Login credentials:\n   Username: ${username}\n   Password: ${password}\n`);
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});

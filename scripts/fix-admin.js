const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Load models
const Employee = require('../models/Employee');

const MONGO_URI = process.env.MONGO_URI;
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD;

if (!MONGO_URI || !adminPassword) {
    console.error('Error: MONGO_URI and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
}

async function fixAdmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        let admin = await Employee.findOne({ username: adminUsername });

        if (admin) {
            console.log(`Found user ${adminUsername}. Current role: ${admin.role}`);
            admin.role = 'admin';
            await admin.save();
            console.log('Role updated to admin!');
        } else {
            console.log(`Admin user ${adminUsername} not found. Creating...`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);

            await Employee.create({
                username: adminUsername,
                password: hashedPassword,
                role: 'admin',
                fullName: 'Administrator',
                phone: '0000000000',
                position: 'Administrator',
                isActive: true
            });
            console.log('Admin user created successfully!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

fixAdmin();

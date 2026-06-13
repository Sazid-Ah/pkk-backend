/**
 * Run this script to promote an Employee account to role='admin'
 * Usage:  node scripts/makeAdmin.js <username>
 * Example: node scripts/makeAdmin.js mypkkadmin
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const username = process.argv[2];

if (!username) {
    console.error('❌ Please provide a username: node scripts/makeAdmin.js <username>');
    process.exit(1);
}

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const employee = await Employee.findOne({ username });
        if (!employee) {
            console.error(`❌ No Employee found with username: "${username}"`);
            process.exit(1);
        }

        const oldRole = employee.role;
        employee.role = 'admin';
        await employee.save();

        console.log(`✅ Success! "${username}" role changed: ${oldRole} → admin`);
        console.log('   You can now log in to the admin panel with these credentials.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();

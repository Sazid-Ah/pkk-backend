const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const seedAdmin = async () => {
    try {
        const username = process.env.ADMIN_USERNAME;
        const password = process.env.ADMIN_PASSWORD;

        if (!username || !password) {
            console.error('Error: ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env file');
            process.exit(1);
        }

        const role = 'admin';

        // Fix for "E11000 duplicate key error collection: pkk_db.employees index: user_1 dup key: { user: null }"
        // Drop the old index if it exists
        try {
            const Employee = require('./models/Employee');
            await Employee.collection.dropIndex('user_1');
            console.log('Dropped old user_1 index');
        } catch (e) {
            // Index might not exist, ignore
        }

        // Check if admin employee exists
        const Employee = require('./models/Employee');
        const adminExists = await Employee.findOne({ username });

        if (adminExists) {
            console.log('Admin employee already exists');
            process.exit();
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create admin employee
        await Employee.create({
            username,
            password: hashedPassword,
            role,
            fullName: 'System Admin',
            phone: '0000000000',
            position: 'Administrator',
            address: 'Headquarters'
        });

        console.log(`Admin user created successfully!`);
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);

        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();

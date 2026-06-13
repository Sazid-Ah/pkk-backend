const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

// @desc    Bootstrap the first admin account
// @route   POST /api/setup/admin
// @access  Protected by SETUP_SECRET env variable — only works if no admin exists yet
const setupAdmin = asyncHandler(async (req, res) => {
    const { secret, username, password, fullName, phone } = req.body;

    // 1. Verify setup secret
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret || secret !== setupSecret) {
        res.status(403);
        throw new Error('Invalid setup secret');
    }

    // 2. Block if an admin already exists
    const existingAdmin = await Employee.findOne({ role: 'admin' });
    if (existingAdmin) {
        res.status(400);
        throw new Error('An admin account already exists. Use the admin panel to manage accounts.');
    }

    // 3. Validate required fields
    if (!username || !password || !fullName || !phone) {
        res.status(400);
        throw new Error('Please provide username, password, fullName and phone');
    }

    // 4. Prevent duplicate username
    const exists = await Employee.findOne({ username });
    if (exists) {
        res.status(400);
        throw new Error('Username already taken');
    }

    // 5. Create the admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await Employee.create({
        username,
        password: hashedPassword,
        role: 'admin',
        fullName,
        phone,
        position: 'Administrator',
        isActive: true,
    });

    res.status(201).json({
        message: 'Admin account created successfully. You can now log in.',
        username: admin.username,
        role: admin.role,
    });
});

module.exports = { setupAdmin };

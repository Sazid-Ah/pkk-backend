const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

/**
 * Ensures an admin account exists on startup.
 * Uses ADMIN_USERNAME and ADMIN_PASSWORD from environment variables.
 * - If an admin already exists: does nothing.
 * - If the username already exists as a non-admin: upgrades its role to admin.
 * - Otherwise: creates a fresh admin account.
 */
const ensureAdminExists = async () => {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        console.warn('[SETUP] ADMIN_USERNAME or ADMIN_PASSWORD not set in .env — skipping admin seed.');
        return;
    }

    try {
        // Check if any admin already exists
        const existingAdmin = await Employee.findOne({ role: 'admin' });
        if (existingAdmin) {
            // Admin already present — nothing to do
            return;
        }

        // Check if an employee with this username already exists but with wrong role
        const existingEmployee = await Employee.findOne({ username: adminUsername });
        if (existingEmployee) {
            // Upgrade role to admin
            existingEmployee.role = 'admin';
            await existingEmployee.save();
            console.log(`[SETUP] Upgraded existing employee "${adminUsername}" to admin role.`);
            return;
        }

        // Create a new admin from scratch
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        await Employee.create({
            username: adminUsername,
            password: hashedPassword,
            role: 'admin',
            fullName: 'Administrator',
            phone: '0000000000',
            position: 'Administrator',
            isActive: true,
        });

        console.log(`[SETUP] Admin account "${adminUsername}" created successfully.`);
    } catch (err) {
        console.error('[SETUP] Failed to seed admin account:', err.message);
    }
};

module.exports = { ensureAdminExists };

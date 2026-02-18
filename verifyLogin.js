const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const verifyLogin = async () => {
    try {
        const Employee = require('./models/Employee');
        const User = require('./models/User');

        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || '123456';

        console.log(`Checking for user: ${username} with password: ${password}`);

        // Check User collection
        const user = await User.findOne({ username });
        if (user) {
            console.log('Found in User collection (Customers)');
            const match = await bcrypt.compare(password, user.password);
            console.log('Password match:', match);
        } else {
            console.log('Not found in User collection');
        }

        // Check Employee collection
        const employee = await Employee.findOne({ username });
        if (employee) {
            console.log('Found in Employee collection (Staff)');
            const match = await bcrypt.compare(password, employee.password);
            console.log('Password match:', match);
            console.log('Role:', employee.role);
        } else {
            console.log('Not found in Employee collection');
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

verifyLogin();

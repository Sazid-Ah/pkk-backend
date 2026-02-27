const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const RegistrationOTP = require('../models/RegistrationOTP');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

dotenv.config();

const API_URL = 'http://localhost:5001/api';
const testEmail = 'verify_' + Date.now() + '@example.com';
const testUsername = 'verifyuser_' + Date.now();
const testPhone = '1234567890';

async function verifyFullFlow() {
    try {
        console.log('--- Connecting to DB ---');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        console.log('--- Creating Verified OTP Record ---');
        await RegistrationOTP.create({
            email: testEmail,
            otp: '123456',
            otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
            isVerified: true
        });
        console.log('OTP record created and verified.');

        console.log('--- Calling Register API ---');
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            username: testUsername,
            email: testEmail,
            password: 'password123',
            phoneNumber: testPhone
        });
        console.log('Register Response:', JSON.stringify(regRes.data, null, 2));

        console.log('--- Verifying Data on DB ---');
        const user = await User.findOne({ email: testEmail });
        if (user && user.phoneNumber === testPhone && user.isOnline === true) {
            console.log('✅ User created correctly with Phone Number and Online status.');
        } else {
            console.error('❌ User data missing or incorrect in DB.');
        }

        const log = await ActivityLog.findOne({ userId: user._id }).sort({ timestamp: -1 });
        if (log && log.activityType === 'registration') {
            console.log('✅ Activity log found for registration.');
        } else if (log) {
            console.log('❓ Found a log but type is:', log.activityType);
        } else {
            console.log('❌ No activity log found for userId:', user._id);
            const anyRecentLog = await ActivityLog.findOne({}).sort({ timestamp: -1 });
            console.log('Most recent log in DB:', anyRecentLog ? anyRecentLog.activityType : 'NONE');
        }

        // Cleanup
        await User.deleteOne({ email: testEmail });
        await ActivityLog.deleteOne({ userId: user._id });
        console.log('--- Cleanup Done ---');

    } catch (error) {
        console.error('Verification failed:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

verifyFullFlow();

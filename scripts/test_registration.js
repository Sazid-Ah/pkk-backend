const axios = require('axios');

const API_URL = 'http://localhost:5001/api';
const testEmail = 'test_' + Date.now() + '@example.com';
const testUsername = 'testuser_' + Date.now();

async function testRegistration() {
    try {
        console.log('--- Testing Register OTP ---');
        const otpRes = await axios.post(`${API_URL}/auth/register-otp`, {
            email: testEmail
        });
        console.log('OTP Result:', otpRes.data);

        // Since we can't get the OTP from email in this environment, 
        // this script will only test the OTP request part.
        // To test the full registration, we'd need to mock the OTP check or bypass it.
        // However, we can check if the record exists in the DB if we had mongo client here.

        console.log('\n--- Note: Full registration verification requires OTP from email or DB access ---');
        console.log('Manual check: Verify RegistrationOTP collection for email:', testEmail);

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testRegistration();

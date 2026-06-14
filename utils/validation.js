const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email.trim())) {
        return { valid: false, error: 'Please provide a valid email address' };
    }
    return { valid: true, error: null };
};

const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required' };
    }
    const normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.length < 10 || normalized.length > 13) {
        return { valid: false, error: 'Please provide a valid phone number' };
    }
    return { valid: true, error: null };
};

const validateOTP = (otp) => {
    if (!otp || typeof otp !== 'string') {
        return { valid: false, error: 'OTP is required' };
    }
    if (!/^\d{6}$/.test(otp.trim())) {
        return { valid: false, error: 'OTP must be a 6-digit code' };
    }
    return { valid: true, error: null };
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one digit' };
    }
    return { valid: true, error: null };
};

module.exports = {
    validateEmail,
    validatePhone,
    validateOTP,
    validatePassword,
};

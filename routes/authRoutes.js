const express = require('express');
const router = express.Router();
const { authLimiter } = require('../middlewares/rateLimiter');
const {
    registerUser,
    loginUser,
    loginCustomer,
    forgotPassword,
    verifyOTP,
    resetPassword,
    refreshToken,
    logout,
    getMe,
    updateProfile,
    getUsers,
    getLoginLogs
} = require('../controllers/authController');
const { protect, admin, employee } = require('../middleware/authMiddleware');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/login/customer', authLimiter, loginCustomer);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/users', protect, admin, getUsers);
router.get('/login-logs', protect, admin, getLoginLogs);

module.exports = router;

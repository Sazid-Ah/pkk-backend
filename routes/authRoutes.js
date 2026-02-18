const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
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
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/users', protect, admin, getUsers);
router.get('/login-logs', protect, admin, getLoginLogs);

module.exports = router;

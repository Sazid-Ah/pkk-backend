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
    getLoginLogs,
    requestRegisterOTP,
    verifyRegisterOTP,
    requestDeleteOTP,
    deleteAccount,
    undoDeleteAccount
} = require('../controllers/authController');
const { protect, admin, employee } = require('../middleware/authMiddleware');

router.post('/register', authLimiter, registerUser);
router.post('/register-otp', authLimiter, requestRegisterOTP);
router.post('/verify-register-otp', authLimiter, verifyRegisterOTP);
router.post('/login', authLimiter, loginUser);
router.post('/login/customer', authLimiter, loginCustomer);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/users', protect, employee, getUsers);
router.get('/login-logs', protect, admin, getLoginLogs);

// Account deletion routes
router.post('/request-delete-otp', authLimiter, requestDeleteOTP);
router.post('/delete-account', authLimiter, deleteAccount);
router.post('/undo-delete-account', authLimiter, undoDeleteAccount);

module.exports = router;

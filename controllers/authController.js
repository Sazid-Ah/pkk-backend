const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const RegistrationOTP = require('../models/RegistrationOTP');
const { sendOTPEmail, sendPasswordResetConfirmation } = require('../utils/emailService');
const { logActivity } = require('./activityLogController');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
        res.status(400);
        throw new Error('Please add a valid email');
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ username }, { email }] });

    if (userExists) {
        res.status(400);
        throw new Error(userExists.username === username ? 'Username already exists' : 'Email already exists');
    }

    // Check if email is verified
    const registeredOTP = await RegistrationOTP.findOne({ email, isVerified: true });
    if (!registeredOTP) {
        res.status(400);
        throw new Error('Email not verified. Please verify your email first.');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
        username,
        email,
        password: hashedPassword,
        role: role || 'user',
    });

    if (user) {
        // Delete the verification record
        await RegistrationOTP.deleteOne({ email });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        res.status(201).json({
            _id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: accessToken,
            refreshToken: refreshToken,
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Authenticate a user (User or Employee)
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { username, password, rememberMe } = req.body;

    // 1. Try finding in User collection (Customers only — role must be 'user' or unset)
    let user = await User.findOne({ username });
    let isEmployee = false;

    // Skip if the found user is not a customer (e.g. role was set to admin/employee in User collection)
    if (user && user.role && user.role !== 'user') {
        user = null;
    }

    // 2. If not found, try Employee collection (Admin/Staff)
    if (!user) {
        const Employee = require('../models/Employee');
        user = await Employee.findOne({ username });
        if (user) {
            isEmployee = true;
        }
    }

    // 3. If not found, try Pandit collection
    let isPandit = false;
    if (!user) {
        const Pandit = require('../models/Pandit');
        user = await Pandit.findOne({ username });
        if (user) {
            isPandit = true;
        }
    }

    if (user && (await bcrypt.compare(password, user.password))) {
        const accessToken = generateAccessToken(user._id, rememberMe);
        const refreshToken = generateRefreshToken(user._id);
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Record login history (keep for backward compatibility)
        const loginEntry = {
            timestamp: new Date(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            device: req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop'
        };

        // Add to login history (keep last 20 entries)
        if (!user.loginHistory) {
            user.loginHistory = [];
        }
        user.loginHistory.unshift(loginEntry);
        if (user.loginHistory.length > 20) {
            user.loginHistory = user.loginHistory.slice(0, 20);
        }

        // Set online status and last active time
        user.isOnline = true;
        user.lastActiveAt = new Date();

        // Save refresh token (only for Users, not Employees or Pandits)
        if (!isEmployee && !isPandit) {
            user.refreshToken = refreshToken;
        }

        await user.save();

        let userTypeDesc = 'User';
        if (isEmployee) userTypeDesc = 'Employee';
        if (isPandit) userTypeDesc = 'Pandit';

        // Log activity in ActivityLog collection (non-blocking)
        try {
            await logActivity(
                user._id,
                userTypeDesc,
                user.username || user.name,
                user.email || '',
                isPandit ? 'pandit' : (isEmployee ? (user.role || 'employee') : (user.role || 'user')),
                'login',
                req.ip || req.connection.remoteAddress,
                req.get('user-agent'),
                req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
                sessionId,
                `User logged in successfully`
            );
        } catch (logErr) {
            console.error('Activity log failed (non-fatal):', logErr.message);
        }

        res.json({
            _id: user.id,
            username: user.username,
            email: user.email,
            role: isPandit ? 'pandit' : (isEmployee ? (user.role || 'employee') : (user.role || 'user')),
            phoneNumber: user.phoneNumber,
            avatar: user.avatar,
            addresses: user.addresses,
            isOnline: user.isOnline,
            lastActiveAt: user.lastActiveAt,
            token: accessToken,
            refreshToken: !isEmployee ? refreshToken : undefined,
            sessionId: sessionId,
            // Optional: return full profile if employee
            ...(isEmployee ? {
                fullName: user.fullName,
                position: user.position
            } : {}),
            ...(isPandit ? {
                name: user.name,
                specialty: user.specialty,
                isFeatured: user.isFeatured
            } : {})
        });
    } else {
        res.status(401);
        throw new Error('Invalid credentials');
    }
});

// @desc    Authenticate a customer (User role only) - for mobile app
// @route   POST /api/auth/login/customer
// @access  Public
const loginCustomer = asyncHandler(async (req, res) => {
    const { username, password, rememberMe } = req.body;

    // Only check User collection (customers)
    const user = await User.findOne({ username });

    if (!user) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    // Reject non-customer roles (e.g. someone added as admin in User collection)
    if (user.role && user.role !== 'user') {
        res.status(403);
        throw new Error('Access denied. Please use the admin portal to log in.');
    }

    if (!(await bcrypt.compare(password, user.password))) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    const accessToken = generateAccessToken(user._id, rememberMe);
    const refreshToken = generateRefreshToken(user._id);
    const sessionId = crypto.randomBytes(16).toString('hex');

    const loginEntry = {
        timestamp: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        device: req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop'
    };

    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.unshift(loginEntry);
    if (user.loginHistory.length > 20) user.loginHistory = user.loginHistory.slice(0, 20);

    user.isOnline = true;
    user.lastActiveAt = new Date();
    user.refreshToken = refreshToken;

    await user.save();

    await logActivity(
        user._id,
        'User',
        user.username,
        user.email || '',
        user.role || 'user',
        'login',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        sessionId,
        `Customer logged in via mobile app`
    );

    res.json({
        _id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        phoneNumber: user.phoneNumber,
        avatar: user.avatar,
        addresses: user.addresses,
        isOnline: user.isOnline,
        lastActiveAt: user.lastActiveAt,
        token: accessToken,
        refreshToken,
        sessionId,
    });
});

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('No user found with this email');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP and expiry (10 minutes from now)
    const otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
    await user.save();

    // Send OTP via email
    try {
        await sendOTPEmail(user.email, otp, user.username);
        res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
            email: user.email,
        });
    } catch (error) {
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        res.status(500);
        throw new Error('Failed to send OTP email. Please try again.');
    }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error('Please provide email and OTP');
    }

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (!user.otp || !user.otpExpiry) {
        res.status(400);
        throw new Error('No OTP request found. Please request a new OTP.');
    }

    if (user.otpExpiry < new Date()) {
        res.status(400);
        throw new Error('OTP has expired. Please request a new one.');
    }

    if (user.otp !== otp) {
        res.status(400);
        throw new Error('Invalid OTP');
    }

    // OTP is valid - generate reset token for next step
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        resetToken: resetToken,
        email: user.email,
    });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
        res.status(400);
        throw new Error('Please provide all required fields');
    }

    if (newPassword.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters');
    }

    const user = await User.findOne({ email, resetToken });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear OTP/reset fields
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.resetToken = undefined;
    await user.save();

    // Send confirmation email (don't wait for it)
    sendPasswordResetConfirmation(user.email, user.username).catch(err =>
        console.error('Failed to send confirmation email:', err)
    );

    res.status(200).json({
        success: true,
        message: 'Password reset successful. You can now login with your new password.',
    });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(400);
        throw new Error('Please provide refresh token');
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'abc123456');

        // Find user with this refresh token
        const user = await User.findOne({ _id: decoded.id, refreshToken });

        if (!user) {
            res.status(401);
            throw new Error('Invalid refresh token');
        }

        // Generate new access token
        const newAccessToken = generateAccessToken(user._id);

        res.status(200).json({
            token: newAccessToken,
        });
    } catch (error) {
        res.status(401);
        throw new Error('Invalid or expired refresh token');
    }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
    // req.user is set by auth middleware
    const { sessionId } = req.body;

    // Try User first, then Employee, then Pandit
    let user = await User.findById(req.user._id);
    let isEmployee = false;
    let isPandit = false;

    if (!user) {
        const Employee = require('../models/Employee');
        user = await Employee.findById(req.user._id);
        if (user) {
            isEmployee = true;
        }
    }

    if (!user) {
        const Pandit = require('../models/Pandit');
        user = await Pandit.findById(req.user._id);
        if (user) {
            isPandit = true;
        }
    }

    if (user) {
        // Set offline status
        user.isOnline = false;
        user.lastActiveAt = new Date();

        if (!isEmployee && !isPandit) {
            user.refreshToken = undefined;
        }
        await user.save();

        let userTypeDesc = 'User';
        if (isEmployee) userTypeDesc = 'Employee';
        if (isPandit) userTypeDesc = 'Pandit';

        // Log activity in ActivityLog collection
        await logActivity(
            user._id,
            userTypeDesc,
            user.username || user.name,
            user.email || '',
            user.role,
            'logout',
            req.ip || req.connection.remoteAddress,
            req.get('user-agent'),
            req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
            sessionId,
            `User logged out`
        );
    }

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;
        user.phoneNumber = req.body.phoneNumber || user.phoneNumber;
        user.avatar = req.body.avatar || user.avatar;

        if (req.body.addresses) {
            user.addresses = req.body.addresses;
        }

        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.password, salt);
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            phoneNumber: updatedUser.phoneNumber,
            role: updatedUser.role,
            avatar: updatedUser.avatar,
            addresses: updatedUser.addresses,
            token: generateAccessToken(updatedUser._id), // Optional: refresh token on major update
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    // The req.user is already populated by protect middleware
    const me = req.user.toObject ? req.user.toObject() : req.user;

    // Assign role if missing in old database documents
    if (!me.role) {
        if (me.specialty !== undefined) {
            me.role = 'pandit';
        } else if (me.position !== undefined) {
            me.role = 'employee';
        } else {
            me.role = 'user';
        }
    }

    // Just return it with all necessary fields
    res.status(200).json(me);
});

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({ role: 'user' }).select('-password');
    res.json(users);
});

// @desc    Get login logs (Admin only)
// @route   GET /api/auth/login-logs
// @access  Private/Admin
const getLoginLogs = asyncHandler(async (req, res) => {
    const Employee = require('../models/Employee');

    // Fetch users with login history
    const users = await User.find({ 'loginHistory.0': { $exists: true } })
        .select('username email role loginHistory')
        .lean();

    // Fetch employees with login history
    const employees = await Employee.find({ 'loginHistory.0': { $exists: true } })
        .select('username fullName role loginHistory')
        .lean();

    // Combine and flatten login records
    const userLogs = users.flatMap(user =>
        user.loginHistory.map(log => ({
            ...log,
            username: user.username,
            email: user.email,
            role: user.role,
            userType: 'Customer'
        }))
    );

    const employeeLogs = employees.flatMap(emp =>
        emp.loginHistory.map(log => ({
            ...log,
            username: emp.username,
            fullName: emp.fullName,
            role: emp.role,
            userType: 'Staff'
        }))
    );

    // Combine and sort by timestamp (most recent first)
    const allLogs = [...userLogs, ...employeeLogs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 100); // Return last 100 login records

    res.json(allLogs);
});

// Generate Access JWT
const generateAccessToken = (id, rememberMe = false) => {
    const expiresIn = rememberMe ? '30d' : '7d';
    return jwt.sign({ id }, process.env.JWT_SECRET || 'abc123456', {
        expiresIn,
    });
};

// Generate Refresh JWT
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'abc123456', {
        expiresIn: '30d',
    });
};

// @desc    Request Register OTP
// @route   POST /api/auth/register-otp
// @access  Public
const requestRegisterOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email');
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Email already exists');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const otpExpiry = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

    // Update or create RegistrationOTP record
    await RegistrationOTP.findOneAndUpdate(
        { email },
        { otp, otpExpiry, isVerified: false },
        { upsert: true, returnDocument: 'after' }
    );

    // Send OTP via email
    try {
        await sendOTPEmail(email, otp, 'Valued Customer');
        res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
            email: email,
        });
    } catch (error) {
        res.status(500);
        throw new Error('Failed to send OTP email. Please try again.');
    }
});

// @desc    Verify Register OTP
// @route   POST /api/auth/verify-register-otp
// @access  Public
const verifyRegisterOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error('Please provide email and OTP');
    }

    const regOTP = await RegistrationOTP.findOne({ email });

    if (!regOTP) {
        res.status(404);
        throw new Error('Verification request not found');
    }

    if (regOTP.otpExpiry < new Date()) {
        res.status(400);
        throw new Error('OTP has expired');
    }

    if (regOTP.otp !== otp) {
        res.status(400);
        throw new Error('Invalid OTP');
    }

    // Mark as verified
    regOTP.isVerified = true;
    await regOTP.save();

    res.status(200).json({
        success: true,
        message: 'Email verified successfully',
    });
});

module.exports = {
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
};

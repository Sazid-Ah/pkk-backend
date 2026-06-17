const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const DeletionRequest = require('../models/DeletionRequest');
const Order = require('../models/Order');
const RegistrationOTP = require('../models/RegistrationOTP');
const { sendOTPEmail, sendPasswordResetConfirmation } = require('../utils/emailService');
const { validateEmail, validatePassword, validateOTP } = require('../utils/validation');
const { logActivity } = require('./activityLogController');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    let { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    // Normalize inputs
    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();

    // Validate email and password format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        res.status(400);
        throw new Error(emailValidation.error);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        res.status(400);
        throw new Error(passwordValidation.error);
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

    // Create user - hardcode role to 'user' for security
    const user = await User.create({
        username,
        fullName: fullName ? fullName.trim() : '',
        email,
        password: hashedPassword,
        role: 'user',
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
            fullName: user.fullName,
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
    let { username, password, rememberMe } = req.body;

    if (username) {
        username = username.trim().toLowerCase();
    }

    // 1. Try finding in Employee collection first (Admin/Staff have highest priority)
    const Employee = require('../models/Employee');
    let user = await Employee.findOne({ username });
    let isEmployee = false;
    let isPandit = false;

    if (user && (await bcrypt.compare(password, user.password))) {
        isEmployee = true;
    } else {
        user = null; // Clear if not found or password mismatch
    }

    // 2. If not found, try Pandit collection
    if (!user) {
        const Pandit = require('../models/Pandit');
        user = await Pandit.findOne({ username });
        if (user && (await bcrypt.compare(password, user.password))) {
            isPandit = true;
        } else {
            user = null;
        }
    }

    // 3. Finally, try User collection (Customers)
    if (!user) {
        user = await User.findOne({ username });
        // Validation: Customers must have role 'user' or no role
        if (user && user.role && user.role !== 'user') {
            user = null;
        }
        if (user && !(await bcrypt.compare(password, user.password))) {
            user = null;
        }
    }

    if (user) {
        // Check if account is pending deletion
        if (user.isDeletionPending) {
            return res.status(403).json({
                success: false,
                message: 'Your account is pending deletion. Please contact support if you wish to cancel this request.',
                errorCode: 'DELETION_PENDING'
            });
        }

        const accessToken = generateAccessToken(user._id, rememberMe);
        const refreshToken = generateRefreshToken(user._id);
        const sessionId = crypto.randomBytes(32).toString('hex');

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

        user.refreshToken = refreshToken;

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
            fullName: user.fullName || '',
            email: user.email,
            role: isPandit ? 'pandit' : (isEmployee ? (user.role || 'employee') : (user.role || 'user')),
            phoneNumber: user.phoneNumber,
            avatar: user.avatar || user.image,
            addresses: user.addresses,
            isOnline: user.isOnline,
            lastActiveAt: user.lastActiveAt,
            token: accessToken,
            refreshToken,
            sessionId: sessionId,
            // Optional: return full profile if employee
            ...(isEmployee ? {
                position: user.position
            } : {}),
            ...(isPandit ? {
                name: user.name,
                specialty: user.specialty,
                isFeatured: user.isFeatured
            } : {}),
            isFirstOrder: !(await Order.exists({ user: user._id }))
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

    if (user.isDeletionPending) {
        return res.status(403).json({
            success: false,
            message: 'Your account is pending deletion. Please contact support if you wish to cancel this request.',
            errorCode: 'DELETION_PENDING'
        });
    }

    const accessToken = generateAccessToken(user._id, rememberMe);
    const refreshToken = generateRefreshToken(user._id);
    const sessionId = crypto.randomBytes(32).toString('hex');

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
        fullName: user.fullName || '',
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
        isFirstOrder: !(await Order.exists({ user: user._id })),
    });
});

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    let { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email');
    }

    email = email.trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('No user found with this email');
    }

    // Generate 6-digit OTP using cryptographically secure random
    const otp = crypto.randomInt(100000, 1000000).toString();

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

// @desc    Request Account Deletion OTP
// @route   POST /api/auth/request-delete-otp
// @access  Public
const requestDeleteOTP = asyncHandler(async (req, res) => {
    let { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    email = email.trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('No user found with this email');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Incorrect password');
    }

    // Generate 6-digit OTP using cryptographically secure random
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Set OTP and expiry (10 minutes)
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP via email with specific deletion theme
    try {
        await sendOTPEmail(user.email, otp, user.username, 'Account Deletion OTP - Pandit Katha Kalyan', 'Account Deletion Request');
        res.status(200).json({
            success: true,
            message: 'Deletion verification code sent to your email',
            email: user.email,
        });
    } catch (error) {
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();
        res.status(500);
        throw new Error('Failed to send verification code. Please try again.');
    }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
    let { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error('Please provide email and OTP');
    }

    email = email.trim().toLowerCase();
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
    let { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
        res.status(400);
        throw new Error('Please provide all required fields');
    }

    email = email.trim().toLowerCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        res.status(400);
        throw new Error(emailValidation.error);
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        res.status(400);
        throw new Error(passwordValidation.error);
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
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

        // Find user in User, Employee, or Pandit collections
        const Employee = require('../models/Employee');
        const Pandit = require('../models/Pandit');
        const user =
            (await User.findOne({ _id: decoded.id, refreshToken })) ||
            (await Employee.findOne({ _id: decoded.id, refreshToken })) ||
            (await Pandit.findOne({ _id: decoded.id, refreshToken }));

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

        user.refreshToken = undefined;
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
        if (req.body.username) {
            user.username = req.body.username.trim().toLowerCase();
        }
        if (req.body.fullName !== undefined) {
            user.fullName = req.body.fullName.trim();
        }
        if (req.body.email) {
            user.email = req.body.email.trim().toLowerCase();
        }
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
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            phoneNumber: updatedUser.phoneNumber,
            role: updatedUser.role,
            avatar: updatedUser.avatar || updatedUser.image,
            addresses: updatedUser.addresses,
            token: generateAccessToken(updatedUser._id), // Optional: refresh token on major update
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Change password for the logged-in user (verifies current password)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400);
        throw new Error('Please provide your current and new password');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
        res.status(400);
        throw new Error('Current password is incorrect');
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        res.status(400);
        throw new Error(passwordValidation.error);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    sendPasswordResetConfirmation(user.email, user.username).catch((err) =>
        console.error('Failed to send password change confirmation:', err)
    );

    res.json({ success: true, message: 'Password changed successfully' });
});

// ── Account change verification (OTP) ─────────────────────────────────────────
const OTP_MINUTES = () => parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
const makeOtp = () => crypto.randomInt(100000, 1000000).toString();
const otpValid = (user, otp, purpose) =>
    !!user.otp && user.otpPurpose === purpose && user.otp === String(otp || '').trim() &&
    !!user.otpExpiry && user.otpExpiry > new Date();

const userPayload = (u) => ({
    _id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    role: u.role,
    avatar: u.avatar || u.image,
    addresses: u.addresses,
    token: generateAccessToken(u._id),
});

// @desc    Request an OTP to confirm an identity (profile) change
// @route   POST /api/auth/account/request-otp
// @access  Private
const requestProfileOtp = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('User not found'); }
    const otp = makeOtp();
    user.otp = otp;
    user.otpPurpose = 'profile';
    user.otpExpiry = new Date(Date.now() + OTP_MINUTES() * 60 * 1000);
    await user.save();
    try {
        await sendOTPEmail(user.email, otp, user.username || user.email, 'Verify profile change - Pandit Katha Kalyan', 'Confirm Profile Update');
    } catch (e) {
        res.status(500); throw new Error('Could not send verification code. Please try again.');
    }
    res.json({ success: true, message: 'Verification code sent to your email' });
});

// @desc    Apply identity changes after OTP verification
// @route   PUT /api/auth/account/profile
// @access  Private
const updateProfileVerified = asyncHandler(async (req, res) => {
    const { otp, fullName, username, phoneNumber } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('User not found'); }
    if (!otpValid(user, otp, 'profile')) {
        res.status(400); throw new Error('Invalid or expired verification code');
    }
    if (username && username.trim().toLowerCase() !== user.username) {
        const exists = await User.findOne({ username: username.trim().toLowerCase() });
        if (exists) { res.status(400); throw new Error('Username already taken'); }
        user.username = username.trim().toLowerCase();
    }
    if (fullName !== undefined) user.fullName = String(fullName).trim();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = '';
    const updated = await user.save();
    res.json(userPayload(updated));
});

// @desc    Email change step 1 — send OTP to the current email
// @route   POST /api/auth/account/email/start
// @access  Private
const startEmailChange = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('User not found'); }
    const otp = makeOtp();
    user.otp = otp;
    user.otpPurpose = 'email-current';
    user.otpExpiry = new Date(Date.now() + OTP_MINUTES() * 60 * 1000);
    user.pendingEmail = '';
    await user.save();
    try {
        await sendOTPEmail(user.email, otp, user.username || user.email, 'Verify email change - Pandit Katha Kalyan', 'Confirm Your Current Email');
    } catch (e) {
        res.status(500); throw new Error('Could not send verification code. Please try again.');
    }
    res.json({ success: true, message: 'Verification code sent to your current email' });
});

// @desc    Email change step 2 — verify current OTP, capture new email, send OTP to new email
// @route   POST /api/auth/account/email/confirm-current
// @access  Private
const confirmCurrentEmail = asyncHandler(async (req, res) => {
    const { otp, newEmail } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('User not found'); }
    if (!otpValid(user, otp, 'email-current')) {
        res.status(400); throw new Error('Invalid or expired verification code');
    }
    const email = String(newEmail || '').trim().toLowerCase();
    const v = validateEmail(email);
    if (!v.valid) { res.status(400); throw new Error(v.error); }
    if (email === user.email) { res.status(400); throw new Error('That is already your email'); }
    const taken = await User.findOne({ email });
    if (taken) { res.status(400); throw new Error('That email is already in use'); }

    const otp2 = makeOtp();
    user.pendingEmail = email;
    user.otp = otp2;
    user.otpPurpose = 'email-new';
    user.otpExpiry = new Date(Date.now() + OTP_MINUTES() * 60 * 1000);
    await user.save();
    try {
        await sendOTPEmail(email, otp2, user.username || email, 'Verify your new email - Pandit Katha Kalyan', 'Confirm Your New Email');
    } catch (e) {
        res.status(500); throw new Error('Could not send a code to the new email. Please try again.');
    }
    res.json({ success: true, message: 'Verification code sent to your new email' });
});

// @desc    Email change step 3 — verify new-email OTP and apply the change
// @route   POST /api/auth/account/email/confirm-new
// @access  Private
const confirmNewEmail = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('User not found'); }
    if (!otpValid(user, otp, 'email-new') || !user.pendingEmail) {
        res.status(400); throw new Error('Invalid or expired verification code');
    }
    const taken = await User.findOne({ email: user.pendingEmail });
    if (taken) { res.status(400); throw new Error('That email is already in use'); }
    user.email = user.pendingEmail;
    user.pendingEmail = '';
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpPurpose = '';
    const updated = await user.save();
    res.json(userPayload(updated));
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

    // Map image to avatar for frontend consistency if needed
    if (!me.avatar && me.image) {
        me.avatar = me.image;
    }

    // Just return it with all necessary fields

    // Check if it's the customer's first order
    me.isFirstOrder = !(await Order.exists({ user: req.user._id }));

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
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn });
};

// Generate Refresh JWT
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Request Register OTP
// @route   POST /api/auth/register-otp
// @access  Public
const requestRegisterOTP = asyncHandler(async (req, res) => {
    let { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email');
    }

    email = email.trim().toLowerCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        res.status(400);
        throw new Error(emailValidation.error);
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Email already exists');
    }

    // Generate 6-digit OTP using cryptographically secure random
    const otp = crypto.randomInt(100000, 1000000).toString();
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
        await sendOTPEmail(email, otp, 'Valued Customer', 'Registration OTP - Pandit Katha Kalyan', 'Email Verification');
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
    let { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error('Please provide email and OTP');
    }

    email = email.trim().toLowerCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        res.status(400);
        throw new Error(emailValidation.error);
    }

    const otpValidation = validateOTP(String(otp));
    if (!otpValidation.valid) {
        res.status(400);
        throw new Error(otpValidation.error);
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

// @desc    Delete user account (Mark for deletion after OTP)
// @route   POST /api/auth/delete-account
// @access  Public
const deleteAccount = asyncHandler(async (req, res) => {
    let { email, password, otp } = req.body;

    if (!email || !password || !otp) {
        res.status(400);
        throw new Error('Please provide email, password and verification code');
    }

    email = email.trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Incorrect password');
    }

    // Verify OTP
    if (user.otp !== otp || user.otpExpiry < Date.now()) {
        res.status(400);
        throw new Error('Invalid or expired verification code');
    }

    // Mark user as pending deletion
    user.isDeletionPending = true;
    user.deletionRequestedAt = new Date();
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Create a record in DeletionRequest collection
    await DeletionRequest.create({
        user: user._id,
        email: user.email,
        status: 'pending',
        requestedAt: user.deletionRequestedAt
    });

    // Log the deletion request
    await logActivity(
        user._id,
        'User',
        user.username,
        user.email || '',
        user.role || 'user',
        'account_deletion_requested',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        null,
        `User requested account deletion via website`
    );

    res.status(200).json({
        success: true,
        message: 'Your account has been marked for deletion and will be permanently removed within 24 hours.',
    });
});

// @desc    Undo account deletion (Restore account)
// @route   POST /api/auth/undo-delete-account
// @access  Public
const undoDeleteAccount = asyncHandler(async (req, res) => {
    let { username, password } = req.body;

    if (!username || !password) {
        res.status(400);
        throw new Error('Please provide username and password');
    }

    // Try finding user (could be email or username depending on login type)
    let user = await User.findOne({
        $or: [
            { email: username.trim().toLowerCase() },
            { username: username.trim().toLowerCase() }
        ]
    });

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Incorrect password');
    }

    if (!user.isDeletionPending) {
        res.status(400);
        throw new Error('This account is not pending deletion');
    }

    // Restore account
    user.isDeletionPending = false;
    user.deletionRequestedAt = undefined;
    await user.save();

    // Remove search record in DeletionRequest
    await DeletionRequest.deleteOne({ user: user._id });

    // Log the restoration
    await logActivity(
        user._id,
        'User',
        user.username,
        user.email || '',
        user.role || 'user',
        'account_deletion_cancelled',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        null,
        `User restored account successfully`
    );

    res.status(200).json({
        success: true,
        message: 'Account restored successfully. You can now log in.',
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
    changePassword,
    requestProfileOtp,
    updateProfileVerified,
    startEmailChange,
    confirmCurrentEmail,
    confirmNewEmail,
    getUsers,
    getLoginLogs,
    requestRegisterOTP,
    verifyRegisterOTP,
    requestDeleteOTP,
    deleteAccount,
    undoDeleteAccount,
};

const rateLimit = require('express-rate-limit');

// 1. Global Rate Limiter: Applies to all standard API routes
// Limit each IP to 1000 requests per `windowMs` (15 minutes)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Suppress warning — trust proxy is set at app level
});

// 2. Auth Rate Limiter: Stricter limit for login/register routes to prevent brute force
// Limit each IP to 50 requests per `windowMs` (1 hour)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        message: 'Too many authentication attempts from this IP, please try again after an hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Suppress warning — trust proxy is set at app level
});

// 3. Booking Rate Limiter: Prevent booking spam
const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many booking requests from this IP, please try again after an hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});

// 4. Review Rate Limiter: Prevent review manipulation
const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many review submissions from this IP, please try again after an hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});

// 5. Contact Form Rate Limiter: Prevent spam
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many contact requests from this IP, please try again after an hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});

// 6. Upload Rate Limiter: Prevent upload abuse
const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many upload requests from this IP, please try again after 10 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
});

module.exports = {
    globalLimiter,
    authLimiter,
    bookingLimiter,
    reviewLimiter,
    contactLimiter,
    uploadLimiter,
};

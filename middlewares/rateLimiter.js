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
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
});

module.exports = {
    globalLimiter,
    authLimiter
};

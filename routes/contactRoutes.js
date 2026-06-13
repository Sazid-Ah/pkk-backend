const express = require('express');
const router = express.Router();
const { submitInquiry } = require('../controllers/contactController');
const { globalLimiter } = require('../middleware/rateLimiter');

// Contact route is public but fits under a slightly stricter limit if needed
router.post('/', globalLimiter, submitInquiry);

module.exports = router;

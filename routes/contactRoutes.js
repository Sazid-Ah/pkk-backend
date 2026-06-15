const express = require('express');
const router = express.Router();
const { submitInquiry } = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimiter');

router.post('/', contactLimiter, submitInquiry);

module.exports = router;

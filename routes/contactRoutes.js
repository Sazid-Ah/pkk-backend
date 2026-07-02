const express = require('express');
const router = express.Router();
const { submitInquiry, getContacted } = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimiter');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', contactLimiter, submitInquiry);
router.get('/', protect, admin, getContacted);

module.exports = router;

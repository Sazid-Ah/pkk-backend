const express = require('express');
const router = express.Router();
const { submitInquiry, getContacted, updateContactStatus } = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimiter');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', contactLimiter, submitInquiry);
router.get('/', protect, admin, getContacted);
router.put('/:id/status', protect, admin, updateContactStatus);

module.exports = router;

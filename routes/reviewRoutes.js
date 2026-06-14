const express = require('express');
const router = express.Router();
const { addReview, getReviews, getAllReviews } = require('../controllers/reviewController');
const { protect, admin } = require('../middleware/authMiddleware');

// Route:  POST /api/reviews
// Access: Private (Logged in users only)
router.post('/', protect, addReview);

// Route:  GET /api/reviews/admin
// Access: Private/Admin
router.get('/admin', protect, admin, getAllReviews);

// Route:  GET /api/reviews/:itemType/:itemId
// Access: Public
router.get('/:itemType/:itemId', getReviews);

module.exports = router;

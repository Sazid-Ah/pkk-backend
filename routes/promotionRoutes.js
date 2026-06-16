const express = require('express');
const router = express.Router();
const {
    getActivePromotions,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
} = require('../controllers/promotionController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getActivePromotions)
    .post(protect, admin, createPromotion);

// Management list (includes inactive/expired)
router.get('/all', protect, admin, getAllPromotions);

router.route('/:id')
    .put(protect, admin, updatePromotion)
    .delete(protect, admin, deletePromotion);

module.exports = router;

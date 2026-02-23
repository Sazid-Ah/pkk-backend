const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearCacheMiddleware } = require('../middlewares/cacheMiddleware');
const {
    getOccasions,
    createOccasion,
    updateOccasion,
    deleteOccasion,
} = require('../controllers/occasionController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(cacheMiddleware, getOccasions)
    .post(protect, admin, clearCacheMiddleware('/api/occasions'), createOccasion);

router.route('/:id')
    .put(protect, admin, clearCacheMiddleware('/api/occasions'), updateOccasion)
    .delete(protect, admin, clearCacheMiddleware('/api/occasions'), deleteOccasion);

module.exports = router;

const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearCacheMiddleware } = require('../middlewares/cacheMiddleware');
const {
    getPandits,
    createPandit,
    updatePandit,
    deletePandit,
} = require('../controllers/panditController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(cacheMiddleware, getPandits).post(protect, admin, clearCacheMiddleware('/api/pandits'), createPandit);
router
    .route('/:id')
    .put(protect, admin, clearCacheMiddleware('/api/pandits'), updatePandit)
    .delete(protect, admin, clearCacheMiddleware('/api/pandits'), deletePandit);

module.exports = router;

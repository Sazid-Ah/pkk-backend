const express = require('express');
const router = express.Router();

console.log('Loading panditRoutes...');

try {
    const {
        getPandits,
        createPandit,
        updatePandit,
        deletePandit,
        getPanditProfile,
        updatePanditProfile,
        getPanditStats,
    } = require('../controllers/panditController');
    const { protect, admin, pandit } = require('../middleware/authMiddleware');

    console.log('✓ Pandit controller and middleware loaded');

    router.route('/').get(getPandits).post(protect, admin, createPandit);
    router.route('/me').get(protect, pandit, getPanditProfile).put(protect, pandit, updatePanditProfile);
    router.route('/:id/stats').get(getPanditStats);
    router.route('/:id')
        .put(protect, admin, updatePandit)
        .delete(protect, admin, deletePandit);

    console.log('✓ Pandit routes registered');
} catch (error) {
    console.error('❌ Error in panditRoutes:', error);
    console.error('Stack:', error.stack);
}

module.exports = router;

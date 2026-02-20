const express = require('express');
const router = express.Router();
const {
    getPandits,
    getNearby,
    searchWithLocation,
    getPandit,
    createPandit,
    updatePandit,
    deletePandit,
} = require('../controllers/panditController');
const { protect, admin } = require('../middleware/authMiddleware');

// Location-based routes (must come before /:id)
router.get('/nearby', getNearby);
router.get('/search', searchWithLocation);

// CRUD routes
router.route('/').get(getPandits).post(protect, admin, createPandit);
router
    .route('/:id')
    .get(getPandit)
    .put(protect, admin, updatePandit)
    .delete(protect, admin, deletePandit);

module.exports = router;

const express = require('express');
const router = express.Router();

const {
    getPandits,
    createPandit,
    updatePandit,
    deletePandit,
} = require('../controllers/panditController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(getPandits).post(protect, admin, createPandit);
router
    .route('/:id')
    .put(protect, admin, updatePandit)
    .delete(protect, admin, deletePandit);

module.exports = router;

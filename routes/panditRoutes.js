const express = require('express');
const router = express.Router();

const {
    getPandits,
    createPandit,
    updatePandit,
    deletePandit,
    getPanditProfile,
    updatePanditProfile,
} = require('../controllers/panditController');
const { protect, admin, pandit } = require('../middleware/authMiddleware');

router.route('/me').get(protect, pandit, getPanditProfile).put(protect, pandit, updatePanditProfile);


router.route('/').get(getPandits).post(protect, admin, createPandit);
router
    .route('/:id')
    .put(protect, admin, updatePandit)
    .delete(protect, admin, deletePandit);

module.exports = router;

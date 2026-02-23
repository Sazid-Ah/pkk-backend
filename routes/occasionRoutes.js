const express = require('express');
const router = express.Router();

const {
    getOccasions,
    createOccasion,
    updateOccasion,
    deleteOccasion,
} = require('../controllers/occasionController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getOccasions)
    .post(protect, admin, createOccasion);

router.route('/:id')
    .put(protect, admin, updateOccasion)
    .delete(protect, admin, deleteOccasion);

module.exports = router;

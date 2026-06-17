const express = require('express');
const router = express.Router();
const {
    createApplication,
    getApplications,
    updateApplicationStatus,
    deleteApplication,
} = require('../controllers/panditApplicationController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(createApplication)          // public
    .get(protect, admin, getApplications);

router.put('/:id/status', protect, admin, updateApplicationStatus);
router.delete('/:id', protect, admin, deleteApplication);

module.exports = router;

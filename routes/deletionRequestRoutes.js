const express = require('express');
const router = express.Router();
const { protect, employee } = require('../middleware/authMiddleware');
const {
    getDeletionRequests,
    approveDeletionRequest,
    cancelDeletionRequest,
} = require('../controllers/deletionRequestController');

router.get('/', protect, employee, getDeletionRequests);
router.put('/:id/approve', protect, employee, approveDeletionRequest);
router.put('/:id/cancel', protect, employee, cancelDeletionRequest);

module.exports = router;

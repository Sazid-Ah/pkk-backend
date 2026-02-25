const express = require('express');
const router = express.Router();
const {
    createBooking,
    getMyBookings,
    getPanditBookings,
    getPanditEarnings,
    updatePanditBookingStatus,
    getAllBookings,
    updateBookingStatus,
    createRazorpayBookingOrder,
    verifyBookingPayment,
} = require('../controllers/bookingController');
const { protect, admin, pandit } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createBooking)
    .get(protect, admin, getAllBookings);

router.route('/mybookings').get(protect, getMyBookings);

// Pandit-specific routes (must be before /:id routes)
router.route('/pandit').get(protect, pandit, getPanditBookings);
router.route('/pandit/earnings').get(protect, pandit, getPanditEarnings);
router.route('/:id/pandit-status').put(protect, pandit, updatePanditBookingStatus);
router.route('/:id/status').put(protect, admin, updateBookingStatus);
router.route('/:id/razorpay').post(protect, createRazorpayBookingOrder);
router.route('/:id/verify-payment').post(protect, verifyBookingPayment);

module.exports = router;

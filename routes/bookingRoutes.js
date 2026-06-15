const express = require('express');
const router = express.Router();
const {
    getPanditAvailability,
    getBookingById,
    createBooking,
    getMyBookings,
    getPanditBookings,
    getPanditEarnings,
    updatePanditBookingStatus,
    getAllBookings,
    updateBookingStatus,
    createRazorpayBookingOrder,
    verifyBookingPayment,
    cancelBooking,
} = require('../controllers/bookingController');
const { protect, admin, pandit } = require('../middleware/authMiddleware');
const { bookingLimiter } = require('../middleware/rateLimiter');

router.route('/')
    .post(protect, bookingLimiter, createBooking)
    .get(protect, admin, getAllBookings);

router.route('/mybookings').get(protect, getMyBookings);

// Availability check — must be before /:id routes
router.route('/availability/:panditId').get(protect, getPanditAvailability);

// Pandit-specific routes (must be before /:id routes)
router.route('/pandit').get(protect, pandit, getPanditBookings);
router.route('/pandit/earnings').get(protect, pandit, getPanditEarnings);
router.route('/:id/pandit-status').put(protect, pandit, updatePanditBookingStatus);
router.route('/:id/status').put(protect, admin, updateBookingStatus);
router.route('/:id').get(protect, getBookingById);
router.route('/:id/razorpay').post(protect, createRazorpayBookingOrder);
router.route('/:id/verify-payment').post(protect, verifyBookingPayment);
router.route('/:id/cancel').post(protect, cancelBooking);

module.exports = router;

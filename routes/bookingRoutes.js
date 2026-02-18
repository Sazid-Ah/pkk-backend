const express = require('express');
const router = express.Router();
const {
    createBooking,
    getMyBookings,
    getAllBookings,
    updateBookingStatus,
} = require('../controllers/bookingController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createBooking)
    .get(protect, admin, getAllBookings);

router.route('/mybookings').get(protect, getMyBookings);

router.route('/:id/status').put(protect, admin, updateBookingStatus);

module.exports = router;

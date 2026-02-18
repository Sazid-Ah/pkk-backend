const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
    const { pandit, bookingDate, timeSlot, occasion, price, notes, address } = req.body;

    if (!pandit || !bookingDate || !timeSlot || !occasion || !price) {
        res.status(400);
        throw new Error('Please fill all required fields');
    }

    const booking = await Booking.create({
        user: req.user._id,
        pandit,
        bookingDate,
        timeSlot,
        occasion,
        price,
        notes,
        address
    });

    res.status(201).json(booking);
});

// @desc    Get logged in user bookings
// @route   GET /api/bookings/mybookings
// @access  Private
const getMyBookings = asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate('pandit', 'name image specialty')
        .sort('-createdAt');
    res.json(bookings);
});

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
// @access  Private/Admin
const getAllBookings = asyncHandler(async (req, res) => {
    const bookings = await Booking.find({})
        .populate('user', 'username email phoneNumber')
        .populate('pandit', 'name')
        .sort('-createdAt');
    res.json(bookings);
});

// @desc    Update booking status
// @route   PUT /api/bookings/:id/status
// @access  Private/Admin
const updateBookingStatus = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (booking) {
        booking.status = req.body.status || booking.status;
        const updatedBooking = await booking.save();
        res.json(updatedBooking);
    } else {
        res.status(404);
        throw new Error('Booking not found');
    }
});

module.exports = {
    createBooking,
    getMyBookings,
    getAllBookings,
    updateBookingStatus
};

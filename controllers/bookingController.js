const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_S6POX6kqvP3xla',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'wTk7DwC7qpzZ6s3iTVpkJXz7',
});


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

// @desc    Get all bookings for the logged-in Pandit
// @route   GET /api/bookings/pandit
// @access  Private/Pandit
const getPanditBookings = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { pandit: req.user._id };
    if (status) query.status = status;

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
        .populate('user', 'username email phoneNumber')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit));

    res.json({ bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// @desc    Get earnings summary for the logged-in Pandit
// @route   GET /api/bookings/pandit/earnings
// @access  Private/Pandit
const getPanditEarnings = asyncHandler(async (req, res) => {
    const panditId = req.user._id;

    // All completed bookings
    const completed = await Booking.find({ pandit: panditId, status: 'Completed' })
        .select('price bookingDate occasion user')
        .populate('user', 'username')
        .sort('-bookingDate');

    // Pending (confirmed but not yet completed)
    const pendingBookings = await Booking.find({ pandit: panditId, status: { $in: ['Pending', 'Confirmed'] } })
        .select('price bookingDate');

    const totalEarned = completed.reduce((sum, b) => sum + (b.price || 0), 0);
    const totalPending = pendingBookings.reduce((sum, b) => sum + (b.price || 0), 0);

    // Monthly breakdown (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await Booking.aggregate([
        {
            $match: {
                pandit: panditId,
                status: 'Completed',
                bookingDate: { $gte: sixMonthsAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$bookingDate' },
                    month: { $month: '$bookingDate' }
                },
                total: { $sum: '$price' },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // This month
    const now = new Date();
    const thisMonthEarnings = completed
        .filter(b => {
            const d = new Date(b.bookingDate);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, b) => sum + (b.price || 0), 0);

    res.json({
        totalEarned,
        totalPending,
        thisMonthEarnings,
        completedCount: completed.length,
        pendingCount: pendingBookings.length,
        monthlyBreakdown: monthlyData,
        recentCompleted: completed.slice(0, 10)
    });
});

// @desc    Pandit updates booking status (Confirm or Complete)
// @route   PUT /api/bookings/:id/pandit-status
// @access  Private/Pandit
const updatePanditBookingStatus = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    // Only the assigned pandit can update
    if (booking.pandit.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this booking');
    }

    const { status } = req.body;
    const allowedTransitions = ['Confirmed', 'Completed'];
    if (!allowedTransitions.includes(status)) {
        res.status(400);
        throw new Error('Pandit can only set status to Confirmed or Completed');
    }

    booking.status = status;
    const updated = await booking.save();
    res.json(updated);
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

// @desc    Create a Razorpay order for a booking (for online payment)
// @route   POST /api/bookings/:id/razorpay
// @access  Private
const createRazorpayBookingOrder = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }
    if (booking.user.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    const amountInPaise = Math.round(Number(booking.price) * 100);
    const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `booking_${booking._id}`,
        notes: { bookingId: booking._id.toString() },
    };

    try {
        const rzpOrder = await razorpay.orders.create(options);
        booking.razorpayOrderId = rzpOrder.id;
        booking.paymentMethod = 'Online';
        await booking.save();

        res.json({
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_S6POX6kqvP3xla',
            bookingId: booking._id,
        });
    } catch (error) {
        console.error('Razorpay Error:', error);
        res.status(500);
        throw new Error('Could not create Razorpay order for booking');
    }
});

// @desc    Verify Razorpay payment for a booking
// @route   POST /api/bookings/:id/verify-payment
// @access  Private
const verifyBookingPayment = asyncHandler(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'wTk7DwC7qpzZ6s3iTVpkJXz7')
        .update(body)
        .digest('hex');

    if (expectedSignature === razorpaySignature) {
        booking.razorpayPaymentId = razorpayPaymentId;
        booking.razorpaySignature = razorpaySignature;
        booking.paymentStatus = 'Paid';
        booking.paymentMethod = 'Online';
        await booking.save();
        res.json({ success: true, message: 'Payment verified successfully', booking });
    } else {
        booking.paymentStatus = 'Failed';
        await booking.save();
        res.status(400);
        throw new Error('Payment verification failed. Invalid signature.');
    }
});

module.exports = {
    createBooking,
    getMyBookings,
    getPanditBookings,
    getPanditEarnings,
    updatePanditBookingStatus,
    getAllBookings,
    updateBookingStatus,
    createRazorpayBookingOrder,
    verifyBookingPayment,
};

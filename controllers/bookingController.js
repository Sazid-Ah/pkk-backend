const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const RefundLog = require('../models/RefundLog');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendBookingCancellationEmail } = require('../utils/emailService');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const withRazorpayTimeout = (promise, ms = 10000) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Razorpay request timed out')), ms)
        ),
    ]);


// @desc    Get booked time slots for a pandit on a specific date
// @route   GET /api/bookings/availability/:panditId?date=YYYY-MM-DD
// @access  Private
const getPanditAvailability = asyncHandler(async (req, res) => {
    const { panditId } = req.params;
    const { date } = req.query;

    if (!date) {
        res.status(400);
        throw new Error('date query parameter is required');
    }

    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const bookings = await Booking.find({
        pandit: panditId,
        bookingDate: { $gte: start, $lte: end },
        status: { $in: ['Pending', 'Confirmed'] },
    }).select('timeSlot');

    res.json({ date, bookedSlots: bookings.map(b => String(b.timeSlot)) });
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

    // Prevent booking in the past
    const slotTime = new Date(bookingDate);
    if (slotTime < new Date()) {
        res.status(400);
        throw new Error('Cannot book a slot in the past');
    }

    // Check for existing booking at the same pandit + date + time slot
    const dayStart = new Date(bookingDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(bookingDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const conflict = await Booking.findOne({
        pandit,
        bookingDate: { $gte: dayStart, $lte: dayEnd },
        timeSlot: String(timeSlot),
        status: { $in: ['Pending', 'Confirmed'] },
    });

    if (conflict) {
        res.status(409);
        throw new Error('This time slot is already booked. Please choose a different slot.');
    }

    let booking;
    try {
        booking = await Booking.create({
            user: req.user._id,
            pandit,
            bookingDate,
            timeSlot: String(timeSlot),
            occasion,
            occasionRef: req.body.occasionRef || null,
            price,
            notes,
            address,
        });
    } catch (err) {
        if (err.code === 11000) {
            res.status(409);
            throw new Error('This time slot was just booked by someone else. Please choose a different slot.');
        }
        throw err;
    }

    res.status(201).json(booking);
});

// @desc    Get a single booking by ID
// @route   GET /api/bookings/:id
// @access  Private (booking owner or admin)
const getBookingById = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate('pandit', 'name image specialty email')
        .populate('user', 'username fullName email phoneNumber');

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    const isOwner = booking.user?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isPanditOfBooking = req.user.role === 'pandit' &&
        booking.pandit?._id?.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isPanditOfBooking) {
        res.status(403);
        throw new Error('Not authorized to view this booking');
    }

    res.json(booking);
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
const createRefundLog = async ({ bookingId, orderId, razorpayPaymentId, amount, status, failureReason, razorpayRefundId }) => {
    try {
        await RefundLog.create({
            booking: bookingId || null,
            order: orderId || null,
            razorpayPaymentId,
            razorpayRefundId,
            amount,
            status,
            failureReason: failureReason || '',
        });
    } catch (error) {
        console.error('Error creating refund log:', error);
    }
};

const processBookingRefund = async (booking) => {
    if (!booking.razorpayPaymentId || booking.paymentStatus !== 'Paid') {
        return booking;
    }

    const refundAmountInPaise = Math.round((booking.price || 0) * 100);
    try {
        const refund = await withRazorpayTimeout(
            razorpay.payments.refund(booking.razorpayPaymentId, { amount: refundAmountInPaise })
        );

        booking.paymentStatus = 'Refunded';
        await booking.save();

        await createRefundLog({
            bookingId: booking._id,
            razorpayPaymentId: booking.razorpayPaymentId,
            razorpayRefundId: refund.id,
            amount: booking.price,
            status: 'completed',
        });

        if (booking.user) {
            await booking.populate('user', 'username email');
            if (booking.user.email) {
                await sendBookingCancellationEmail(booking.user.email, booking.user.username || booking.user.email, booking._id.toString(), booking.price || 0);
            }
        }

        return booking;
    } catch (error) {
        console.error('Booking refund failed:', error);
        await createRefundLog({
            bookingId: booking._id,
            razorpayPaymentId: booking.razorpayPaymentId,
            amount: booking.price,
            status: 'failed',
            failureReason: error.message || 'Razorpay refund failed',
        });
        return booking;
    }
};

const updateBookingStatus = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate('user', 'username email');

    if (booking) {
        const updatedStatus = req.body.status || booking.status;
        booking.status = updatedStatus;

        if (updatedStatus === 'Cancelled' && booking.paymentStatus === 'Paid') {
            await processBookingRefund(booking);
        }

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
        const rzpOrder = await withRazorpayTimeout(razorpay.orders.create(options));

        if (!rzpOrder || !rzpOrder.id) {
            console.error('Razorpay returned invalid order:', rzpOrder);
            res.status(500);
            throw new Error('Razorpay order creation failed — check API credentials.');
        }

        booking.razorpayOrderId = rzpOrder.id;
        booking.paymentMethod = 'Online';
        await booking.save();

        res.json({
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
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

    // Idempotency: already verified
    if (booking.paymentStatus === 'Paid') {
        return res.json({ success: true, message: 'Payment already verified', booking });
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400);
        throw new Error('Missing payment details');
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

    if (expectedSignature === razorpaySignature) {
        booking.razorpayPaymentId = razorpayPaymentId;
        booking.razorpaySignature = razorpaySignature;
        booking.paymentStatus = 'Paid';
        booking.paymentMethod = 'Online';
        await booking.save();
        return res.json({ success: true, message: 'Payment verified successfully', booking });
    } else {
        booking.paymentStatus = 'Failed';
        booking.status = 'Cancelled';
        await booking.save();
        res.status(400);
        throw new Error('Payment verification failed. Invalid signature.');
    }
});

// @desc    Cancel a booking (failed/dismissed payment)
// @route   POST /api/bookings/:id/cancel
// @access  Private
const cancelBooking = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    if (booking.user.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Idempotency: already in a terminal state
    if (['Cancelled', 'Completed'].includes(booking.status)) {
        return res.json({ message: 'Booking already in terminal state', booking });
    }

    // Enforce 2-day window only for Confirmed bookings (Pending = payment incomplete, always cancellable)
    if (booking.status === 'Confirmed') {
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
        const timeUntilBooking = new Date(booking.bookingDate) - new Date();
        if (timeUntilBooking < twoDaysMs) {
            res.status(400);
            throw new Error('Bookings can only be cancelled at least 2 days before the booking date.');
        }
    }

    booking.status = 'Cancelled';
    if (booking.paymentStatus === 'Paid') {
        await processBookingRefund(booking);
    } else {
        booking.paymentStatus = 'Failed';
        await booking.save();
    }

    const updatedBooking = await Booking.findById(booking._id);
    res.json({ message: 'Booking cancelled', booking: updatedBooking });
});

module.exports = {
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
};

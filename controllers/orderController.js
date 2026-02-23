const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_S6POX6kqvP3xla',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'wTk7DwC7qpzZ6s3iTVpkJXz7',
});

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
    const { items, totalAmount, shippingAddress } = req.body;

    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    const order = new Order({
        user: req.user._id,
        items,
        totalAmount,
        shippingAddress,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin/Employee
const getOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({}).populate('user', 'id username');
    res.json(orders);
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin/Employee
const updateOrderToStatus = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        order.status = req.body.status || order.status;
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

// @desc    Create Razorpay order for an existing DB order
// @route   POST /api/orders/:id/razorpay
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Ensure order belongs to user or user is admin
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(401);
        throw new Error('Not authorized to access this order');
    }

    try {
        const options = {
            amount: Math.round(order.totalAmount * 100), // amount in smallest currency unit (paise)
            currency: 'INR',
            receipt: `receipt_${order._id}`,
        };

        const rzpOrder = await razorpay.orders.create(options);

        // Save razorpay order ID to our DB
        order.razorpayOrderId = rzpOrder.id;
        await order.save();

        res.json({
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: process.env.RAZORPAY_KEY_ID // Front-end needs the public key
        });
    } catch (error) {
        console.error('Razorpay Error:', error);
        res.status(500);
        throw new Error('Could not create Razorpay order');
    }
});

// @desc    Verify Razorpay payment signature
// @route   POST /api/orders/:id/verify
// @access  Private
const verifyPayment = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400);
        throw new Error('Missing payment details');
    }

    // Verify signature
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    const isAuthentic = expectedSignature === razorpaySignature;

    if (isAuthentic) {
        // Payment is valid
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpaySignature = razorpaySignature;
        order.paymentStatus = 'Paid';
        order.status = 'Confirmed'; // Automatically confirm order on payment
        const updatedOrder = await order.save();

        res.json({ message: 'Payment verified successfully', order: updatedOrder });
    } else {
        // Invalid signature
        order.paymentStatus = 'Failed';
        await order.save();

        res.status(400);
        throw new Error('Invalid payment signature');
    }
});

module.exports = {
    addOrderItems,
    getMyOrders,
    getOrders,
    updateOrderToStatus,
    createRazorpayOrder,
    verifyPayment,
};

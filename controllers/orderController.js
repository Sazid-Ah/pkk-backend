const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const GlobalSettings = require('../models/GlobalSettings');
const RefundLog = require('../models/RefundLog');
const { sendOrderCancellationEmail } = require('../utils/emailService');


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

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    // 1. Fetch Global Settings for Discount
    const settings = await GlobalSettings.findOne();
    const discountPercentage = (settings && settings.isDiscountActive) ? settings.discountPercentage : 0;

    // 2. Calculate Totals Server-side
    let subtotal = 0;
    let productGst = 0;
    let serviceGst = 0;
    let productTotalForDiscount = 0;

    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        if (item.type === 'product') {
            productGst += itemTotal * 0.05; // 5% GST for products
            productTotalForDiscount += itemTotal;
        } else {
            serviceGst += itemTotal * 0.18; // 18% GST for services
        }
    });

    const discountAmount = productTotalForDiscount * (discountPercentage / 100);
    const gstTotal = productGst + serviceGst;
    const finalTotal = subtotal - discountAmount + gstTotal;

    const order = new Order({
        user: req.user._id,
        items,
        totalAmount: finalTotal, // Use server-calculated total
        discountAmount,
        discountPercentage,
        gstAmount: gstTotal,
        shippingAddress,
        paymentMethod: paymentMethod || 'Razorpay',
        // Auto-confirm COD orders since there's no payment gateway confirmation needed
        status: paymentMethod === 'CashOnDelivery' ? 'Confirmed' : 'Pending',
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
});


// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin/Employee
const getOrders = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments({});
    const orders = await Order.find({})
        .populate('user', 'id username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    res.json({ orders, page, pages: Math.ceil(total / limit), total });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin/Employee
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

const processOrderRefund = async (order) => {
    if (!order.razorpayPaymentId || order.paymentStatus !== 'Paid') {
        return order;
    }

    const refundAmountInPaise = Math.round((order.totalAmount || 0) * 100);
    try {
        const refund = await withRazorpayTimeout(
            razorpay.payments.refund(order.razorpayPaymentId, { amount: refundAmountInPaise })
        );

        order.paymentStatus = 'Refunded';
        await order.save();

        await createRefundLog({
            orderId: order._id,
            razorpayPaymentId: order.razorpayPaymentId,
            razorpayRefundId: refund.id,
            amount: order.totalAmount,
            status: 'completed',
        });

        await order.populate('user', 'username email');
        if (order.user?.email) {
            await sendOrderCancellationEmail(order.user.email, order.user.username || order.user.email, order._id.toString(), order.totalAmount || 0);
        }

        return order;
    } catch (error) {
        console.error('Order refund failed:', error);
        await createRefundLog({
            orderId: order._id,
            razorpayPaymentId: order.razorpayPaymentId,
            amount: order.totalAmount,
            status: 'failed',
            failureReason: error.message || 'Razorpay refund failed',
        });
        return order;
    }
};

const ORDER_TRANSITIONS = {
    Pending: ['Processing', 'Cancelled'],
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
};

const updateOrderToStatus = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'username email');

    if (order) {
        const updatedStatus = req.body.status || order.status;

        if (updatedStatus !== order.status) {
            const allowed = ORDER_TRANSITIONS[order.status] || [];
            if (!allowed.includes(updatedStatus)) {
                res.status(400);
                throw new Error(`Cannot transition order from '${order.status}' to '${updatedStatus}'`);
            }
        }

        order.status = updatedStatus;

        if (updatedStatus === 'Cancelled' && order.paymentStatus === 'Paid') {
            await processOrderRefund(order);
        }

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

        const rzpOrder = await withRazorpayTimeout(razorpay.orders.create(options));

        if (!rzpOrder || !rzpOrder.id) {
            console.error('Razorpay returned invalid order:', rzpOrder);
            res.status(500);
            throw new Error('Razorpay order creation failed — check API credentials.');
        }

        // Save razorpay order ID to our DB
        order.razorpayOrderId = rzpOrder.id;
        await order.save();

        res.json({
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
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

    // Idempotency: already verified
    if (order.paymentStatus === 'Paid') {
        return res.json({ message: 'Payment already verified', order });
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
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpaySignature = razorpaySignature;
        order.paymentStatus = 'Paid';
        order.status = 'Confirmed';
        const updatedOrder = await order.save();
        return res.json({ message: 'Payment verified successfully', order: updatedOrder });
    } else {
        order.paymentStatus = 'Failed';
        order.status = 'Cancelled';
        await order.save();
        res.status(400);
        throw new Error('Invalid payment signature');
    }
});

// @desc    Cancel an order (failed/dismissed payment)
// @route   POST /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    // Idempotency: already in a terminal state
    if (['Cancelled', 'Completed'].includes(order.status)) {
        return res.json({ message: 'Order already in terminal state', order });
    }

    // Enforce 5-minute cancellation window
    const fiveMinMs = 5 * 60 * 1000;
    if (new Date() - new Date(order.createdAt) > fiveMinMs) {
        res.status(400);
        throw new Error('Orders can only be cancelled within 5 minutes of placing them.');
    }

    order.status = 'Cancelled';
    if (order.paymentStatus === 'Paid') {
        await processOrderRefund(order);
    } else {
        order.paymentStatus = 'Failed';
        await order.save();
    }

    const updatedOrder = await Order.findById(order._id);
    res.json({ message: 'Order cancelled', order: updatedOrder });
});

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'username fullName email phoneNumber');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'employee') {
        res.status(403);
        throw new Error('Not authorized');
    }

    res.json(order);
});

// @desc    Get order history with filters
// @route   GET /api/orders/history
// @access  Private/Employee/Admin
const getOrderHistory = asyncHandler(async (req, res) => {
    const { status, startDate, endDate } = req.query;

    const query = {};

    if (status && status !== 'all') {
        query.status = status;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    const orders = await Order.find(query)
        .populate('user', 'username email')
        .sort({ createdAt: -1 });

    res.json(orders);
});

module.exports = {
    addOrderItems,
    getMyOrders,
    getOrders,
    getOrderById,
    updateOrderToStatus,
    createRazorpayOrder,
    verifyPayment,
    cancelOrder,
    getOrderHistory,
};

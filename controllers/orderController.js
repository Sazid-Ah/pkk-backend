const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');

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

module.exports = {
    addOrderItems,
    getMyOrders,
    getOrders,
    updateOrderToStatus,
};

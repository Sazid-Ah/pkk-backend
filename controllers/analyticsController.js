const asyncHandler = require('express-async-handler');
const Pandit = require('../models/Pandit');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @desc    Get admin dashboard stats
// @route   GET /api/analytics/admin
// @access  Private/Admin
const getAdminStats = asyncHandler(async (req, res) => {
    // 1. Total Counts
    const totalPandits = await Pandit.countDocuments({});
    const totalProducts = await Product.countDocuments({});
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalBookings = await Booking.countDocuments({});

    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    const pendingBookings = await Booking.countDocuments({ status: 'Pending' });

    // 2. Total Revenue
    const revenueAgg = await Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // 3. Monthly Revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenueAgg = await Order.aggregate([
        {
            $match: {
                status: { $ne: 'Cancelled' },
                createdAt: { $gte: startOfMonth }
            }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const monthlyRevenue = monthlyRevenueAgg.length > 0 ? monthlyRevenueAgg[0].total : 0;

    // 4. Recent Activity (Last 5 items: mixed orders and bookings)
    const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'username email');

    const recentBookings = await Booking.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'username email')
        .populate('pandit', 'name');

    res.json({
        totalPandits,
        totalProducts,
        totalUsers,
        totalBookings,
        pendingOrders,
        pendingBookings,
        totalRevenue,
        monthlyRevenue,
        recentOrders,
        recentBookings
    });
});

module.exports = {
    getAdminStats,
};

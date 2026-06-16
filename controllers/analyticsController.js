const asyncHandler = require('express-async-handler');
const Pandit = require('../models/Pandit');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @desc    Get admin dashboard stats
// @route   GET /api/analytics/admin?from=YYYY-MM-DD&to=YYYY-MM-DD
// @access  Private/Admin
const getAdminStats = asyncHandler(async (req, res) => {
    // Date range for time-series charts — defaults to last 30 days
    const toDate = req.query.to ? new Date(req.query.to) : new Date();
    toDate.setHours(23, 59, 59, 999);
    const fromDate = req.query.from
        ? new Date(req.query.from)
        : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);
    fromDate.setHours(0, 0, 0, 0);

    // 1. Total Counts
    const [totalPandits, totalProducts, totalUsers, totalBookings, pendingOrders, pendingBookings] =
        await Promise.all([
            Pandit.countDocuments({}),
            Product.countDocuments({}),
            User.countDocuments({ role: 'user' }),
            Booking.countDocuments({}),
            Order.countDocuments({ status: 'Pending' }),
            Booking.countDocuments({ status: 'Pending' }),
        ]);

    // 2. Total Revenue (Orders + Bookings, all-time)
    const [revenueAgg, bookingRevenueAgg] = await Promise.all([
        Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$price' } } },
        ]),
    ]);
    const orderRevenue = revenueAgg[0]?.total ?? 0;
    const bookingRevenue = bookingRevenueAgg[0]?.total ?? 0;
    const totalRevenue = orderRevenue + bookingRevenue;

    // 3. Monthly Revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthlyOrderRevenueAgg, monthlyBookingRevenueAgg] = await Promise.all([
        Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$price' } } },
        ]),
    ]);
    const monthlyRevenue = (monthlyOrderRevenueAgg[0]?.total ?? 0) + (monthlyBookingRevenueAgg[0]?.total ?? 0);

    // 4. Recent Activity
    const [recentOrders, recentBookings] = await Promise.all([
        Order.find({}).sort({ createdAt: -1 }).limit(5).populate('user', 'username email'),
        Booking.find({}).sort({ createdAt: -1 }).limit(5)
            .populate('user', 'username email')
            .populate('pandit', 'name'),
    ]);

    // 5. Revenue by day (orders + bookings combined) for the date range
    const [ordersByDay, bookingsByDay] = await Promise.all([
        Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: fromDate, $lte: toDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, amount: { $sum: '$totalAmount' } } },
        ]),
        Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: fromDate, $lte: toDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, amount: { $sum: '$price' } } },
        ]),
    ]);
    const revenueDayMap = {};
    ordersByDay.forEach(({ _id, amount }) => { revenueDayMap[_id] = (revenueDayMap[_id] ?? 0) + amount; });
    bookingsByDay.forEach(({ _id, amount }) => { revenueDayMap[_id] = (revenueDayMap[_id] ?? 0) + amount; });
    const revenueByDay = Object.entries(revenueDayMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // 6. Bookings by status (all-time totals)
    const bookingStatusAgg = await Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const bookingsByStatus = Object.fromEntries(bookingStatusAgg.map(({ _id, count }) => [_id, count]));

    // 7. Orders by status (all-time totals)
    const orderStatusAgg = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const ordersByStatus = Object.fromEntries(orderStatusAgg.map(({ _id, count }) => [_id, count]));

    // 8. Top 5 pandits by booking count + revenue in date range
    const topPanditAgg = await Booking.aggregate([
        { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: '$pandit', bookingCount: { $sum: 1 }, revenue: { $sum: '$price' } } },
        { $sort: { bookingCount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'pandits', localField: '_id', foreignField: '_id', as: 'panditInfo' } },
        { $unwind: { path: '$panditInfo', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: '$panditInfo.name', bookingCount: 1, revenue: 1, rating: '$panditInfo.rating' } },
    ]);
    const topPandits = topPanditAgg;

    // 9. Top 5 products by order count + revenue in date range
    const topProductAgg = await Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: fromDate, $lte: toDate } } },
        { $unwind: '$items' },
        { $match: { 'items.type': 'product' } },
        { $group: { _id: '$items.originalId', name: { $first: '$items.name' }, orderCount: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
        { $sort: { orderCount: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: 1, orderCount: 1, revenue: 1 } },
    ]);
    const topProducts = topProductAgg;

    // 10. User growth — cumulative users per day in date range
    const userGrowthAgg = await User.aggregate([
        { $match: { role: 'user', createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, newUsers: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    const baseUserCount = await User.countDocuments({ role: 'user', createdAt: { $lt: fromDate } });
    let cumulative = baseUserCount;
    const userGrowth = userGrowthAgg.map(({ _id, newUsers }) => {
        cumulative += newUsers;
        return { date: _id, cumulativeCount: cumulative };
    });

    res.json({
        totalPandits,
        totalProducts,
        totalUsers,
        totalBookings,
        pendingOrders,
        pendingBookings,
        totalRevenue,
        orderRevenue,
        bookingRevenue,
        monthlyRevenue,
        recentOrders,
        recentBookings,
        revenueByDay,
        bookingsByStatus,
        ordersByStatus,
        topPandits,
        topProducts,
        userGrowth,
    });
});

// @desc    Get employee dashboard stats
// @route   GET /api/analytics/employee
// @access  Private/Employee
const getEmployeeStats = asyncHandler(async (req, res) => {
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    const pendingBookings = await Booking.countDocuments({ status: 'Pending' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const completedToday = await Order.countDocuments({
        status: 'Completed',
        updatedAt: { $gte: today, $lt: tomorrow }
    });

    const todayOrders = await Order.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
    });

    res.json({
        pendingOrders,
        pendingBookings,
        completedToday,
        todayOrders,
    });
});

module.exports = {
    getAdminStats,
    getEmployeeStats,
};

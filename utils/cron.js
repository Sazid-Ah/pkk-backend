const cron = require('node-cron');
const DeletionRequest = require('../models/DeletionRequest');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const { logActivity } = require('../controllers/activityLogController');

const runPendingDeletionCleanup = async () => {
    try {
        const deletionWindowDays = parseInt(process.env.DELETION_GRACE_DAYS) || 7;
        const cutoff = new Date(Date.now() - deletionWindowDays * 24 * 60 * 60 * 1000);

        const requests = await DeletionRequest.find({ status: 'pending', requestedAt: { $lte: cutoff } });

        for (const request of requests) {
            const user = await User.findById(request.user);
            if (!user) {
                request.status = 'completed';
                await request.save();
                continue;
            }

            await User.deleteOne({ _id: user._id });
            request.status = 'completed';
            await request.save();

            await logActivity(
                user._id,
                'User',
                user.username,
                user.email || '',
                user.role || 'user',
                'account_deleted',
                'system',
                'Cron',
                'System',
                null,
                `Account deleted after pending deletion window`
            );
        }
    } catch (error) {
        console.error('Error during pending deletion cleanup cron:', error);
    }
};

const runAutoConfirmBookings = async () => {
    try {
        const daysUntilAutoConfirm = parseInt(process.env.AUTO_CONFIRM_DAYS) || 2;
        const cutoff = new Date(Date.now() - daysUntilAutoConfirm * 24 * 60 * 60 * 1000);

        const bookings = await Booking.find({
            status: 'Pending',
            paymentStatus: 'Paid',
            createdAt: { $lte: cutoff },
        });

        for (const booking of bookings) {
            booking.status = 'Confirmed';
            await booking.save();
            await logActivity(
                booking.user,
                'User',
                null,
                null,
                'user',
                'booking_auto_confirmed',
                'system',
                'Cron',
                'System',
                booking._id,
                `Booking auto-confirmed after ${daysUntilAutoConfirm} days`
            );
        }
    } catch (error) {
        console.error('Error during auto-confirm bookings cron:', error);
    }
};

const runAutoConfirmOrders = async () => {
    try {
        const daysUntilAutoConfirm = parseInt(process.env.AUTO_CONFIRM_DAYS) || 2;
        const cutoff = new Date(Date.now() - daysUntilAutoConfirm * 24 * 60 * 60 * 1000);

        const orders = await Order.find({
            status: 'Pending',
            paymentStatus: 'Paid',
            createdAt: { $lte: cutoff },
        });

        for (const order of orders) {
            order.status = 'Confirmed';
            await order.save();
            await logActivity(
                order.user,
                'User',
                null,
                null,
                'user',
                'order_auto_confirmed',
                'system',
                'Cron',
                'System',
                order._id,
                `Order auto-confirmed after ${daysUntilAutoConfirm} days`
            );
        }
    } catch (error) {
        console.error('Error during auto-confirm orders cron:', error);
    }
};

const startCronJobs = () => {
    const deletionCronSchedule = process.env.DELETION_CLEANUP_CRON || '0 2 * * *';
    const autoConfirmCronSchedule = process.env.AUTO_CONFIRM_CRON || '0 3 * * *';

    cron.schedule(deletionCronSchedule, runPendingDeletionCleanup, {
        timezone: process.env.CRON_TIMEZONE || 'UTC',
    });

    cron.schedule(autoConfirmCronSchedule, runAutoConfirmBookings, {
        timezone: process.env.CRON_TIMEZONE || 'UTC',
    });

    cron.schedule(autoConfirmCronSchedule, runAutoConfirmOrders, {
        timezone: process.env.CRON_TIMEZONE || 'UTC',
    });

    console.log('✅ Cron jobs scheduled:', {
        deletionCronSchedule,
        autoConfirmCronSchedule,
    });
};

module.exports = {
    startCronJobs,
    runPendingDeletionCleanup,
    runAutoConfirmBookings,
    runAutoConfirmOrders,
};

const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Pandit = require('../models/Pandit');
const Product = require('../models/Product');
const Booking = require('../models/Booking');
const Order = require('../models/Order');

// @desc    Add a review
// @route   POST /api/reviews
// @access  Private
const addReview = asyncHandler(async (req, res) => {
    try {
        const { itemType, itemId, rating, comment, bookingId, orderId } = req.body;
        const userId = req.user.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Please provide a rating between 1 and 5' });
        }

        if (!bookingId && !orderId) {
            return res.status(400).json({ success: false, message: 'A review must be associated with a Booking or Order' });
        }

        // 1. Check if the user is authorized to review this (must own the booking/order AND it must be Completed)
        if (bookingId) {
            const booking = await Booking.findOne({ _id: bookingId, user: userId });
            if (!booking) {
                return res.status(404).json({ success: false, message: 'Booking not found or not authorized' });
            }
            if (booking.status !== 'Completed') {
                return res.status(400).json({ success: false, message: 'You can only review completed services' });
            }
            if (booking.isRated) {
                return res.status(400).json({ success: false, message: 'You have already reviewed this booking' });
            }
            // Verify Pandit matches
            if (booking.pandit.toString() !== itemId) {
                return res.status(400).json({ success: false, message: 'Item ID does not match the booking' });
            }
        } else if (orderId) {
            const order = await Order.findOne({ _id: orderId, user: userId });
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found or not authorized' });
            }
            if (order.status !== 'Completed') {
                return res.status(400).json({ success: false, message: 'You can only review completed orders' });
            }
            // Find the specific item in the order
            const orderItem = order.items.find(item => item.originalId.toString() === itemId);
            if (!orderItem) {
                return res.status(400).json({ success: false, message: 'Item not found in this order' });
            }
            if (orderItem.isRated) {
                return res.status(400).json({ success: false, message: 'You have already reviewed this item in this order' });
            }
        }

        // 2. Create the Review
        const review = await Review.create({
            user: userId,
            itemType,
            itemId,
            rating,
            comment,
            bookingId: bookingId || null,
            orderId: orderId || null
        });

        // 3. Update the appropriate Model's average rating 
        let updatedAverage = 0;
        if (itemType === 'Pandit') {
            const pandit = await Pandit.findById(itemId);
            if (pandit) {
                const totalRating = (pandit.rating || 0) * (pandit.numReviews || 0);
                pandit.numReviews = (pandit.numReviews || 0) + 1;
                pandit.rating = (totalRating + rating) / pandit.numReviews;
                updatedAverage = pandit.rating;
                await pandit.save();
            }
        } else if (itemType === 'Product') {
            const product = await Product.findById(itemId);
            if (product) {
                const totalRating = (product.rating || 0) * (product.numReviews || 0);
                product.numReviews = (product.numReviews || 0) + 1;
                product.rating = (totalRating + rating) / product.numReviews;
                updatedAverage = product.rating;
                await product.save();
            }
        }

        // 4. Mark the Order/Booking as rated
        if (bookingId) {
            await Booking.findByIdAndUpdate(bookingId, { isRated: true });
        } else if (orderId) {
            await Order.findOneAndUpdate(
                { _id: orderId, 'items.originalId': itemId },
                { $set: { 'items.$.isRated': true } }
            );
        }

        res.status(201).json({
            success: true,
            data: review,
            updatedAverage
        });

    } catch (error) {
        console.error('Error adding review:', error);
        // Catch duplicate key error (if the manual index hits)
        if (error.code === 11000) {
             return res.status(400).json({ success: false, message: 'You have already reviewed this' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @desc    Get reviews for an item
// @route   GET /api/reviews/:itemType/:itemId
// @access  Public
const getReviews = asyncHandler(async (req, res) => {
    try {
        const { itemType, itemId } = req.params;
        
        const reviews = await Review.find({ itemType, itemId })
            .populate('user', 'username email')
            .sort({ createdAt: -1 });
            
        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @desc    Get reviews with optional filters (admin only)
// @route   GET /api/reviews/admin
// @access  Private/Admin
const getAllReviews = asyncHandler(async (req, res) => {
    try {
        const { itemType, itemId, rating, userId } = req.query;
        const filter = {};

        if (itemType) filter.itemType = itemType;
        if (itemId) filter.itemId = itemId;
        if (rating) filter.rating = Number(rating);
        if (userId) filter.user = userId;

        const reviews = await Review.find(filter)
            .populate('user', 'username email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = {
    addReview,
    getReviews,
    getAllReviews,
};

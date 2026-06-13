const express = require('express');
const router = express.Router();
const {
    addOrderItems,
    getMyOrders,
    getOrders,
    getOrderById,
    updateOrderToStatus,
    createRazorpayOrder,
    verifyPayment,
    cancelOrder,
    getOrderHistory,
} = require('../controllers/orderController');
const { protect, admin, employee } = require('../middleware/authMiddleware');

router.route('/').post(protect, addOrderItems).get(protect, employee, getOrders);
router.route('/history').get(protect, employee, getOrderHistory);
router.route('/myorders').get(protect, getMyOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/razorpay').post(protect, createRazorpayOrder);
router.route('/:id/verify').post(protect, verifyPayment);
router.route('/:id/cancel').post(protect, cancelOrder);
router.route('/:id/status').put(protect, employee, updateOrderToStatus);

module.exports = router;

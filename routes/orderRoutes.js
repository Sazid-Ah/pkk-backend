const express = require('express');
const router = express.Router();
const {
    addOrderItems,
    getMyOrders,
    getOrders,
    updateOrderToStatus,
    createRazorpayOrder,
    verifyPayment,
    getOrderHistory,
} = require('../controllers/orderController');
const { protect, admin, employee, adminOrEmployee } = require('../middleware/authMiddleware');

router.route('/').post(protect, addOrderItems).get(protect, adminOrEmployee, getOrders);
router.route('/history').get(protect, adminOrEmployee, getOrderHistory);
router.route('/myorders').get(protect, getMyOrders);
router.route('/:id/razorpay').post(protect, createRazorpayOrder);
router.route('/:id/verify').post(protect, verifyPayment);
router.route('/:id/status').put(protect, adminOrEmployee, updateOrderToStatus);

module.exports = router;

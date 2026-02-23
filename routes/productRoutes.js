const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearCacheMiddleware } = require('../middlewares/cacheMiddleware');
const {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').get(cacheMiddleware, getProducts).post(protect, admin, clearCacheMiddleware('/api/products'), createProduct);
router
    .route('/:id')
    .put(protect, admin, clearCacheMiddleware('/api/products'), updateProduct)
    .delete(protect, admin, clearCacheMiddleware('/api/products'), deleteProduct);

module.exports = router;

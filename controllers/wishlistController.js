const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');
const Pandit = require('../models/Pandit');

const VALID_TYPES = ['product', 'pandit'];

// @desc    Get the logged-in user's wishlist (resolved to full products & pandits)
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('wishlist');
    const entries = user?.wishlist || [];

    const productIds = entries.filter((e) => e.itemType === 'product').map((e) => e.itemId);
    const panditIds = entries.filter((e) => e.itemType === 'pandit').map((e) => e.itemId);

    const [products, pandits] = await Promise.all([
        productIds.length ? Product.find({ _id: { $in: productIds } }).populate('occasions') : [],
        panditIds.length ? Pandit.find({ _id: { $in: panditIds } }).select('-password -refreshToken -loginHistory').populate('occasions') : [],
    ]);

    res.json({
        products,
        pandits,
        // lightweight key list so the client can render heart states without the full docs
        keys: entries.map((e) => ({ itemType: e.itemType, itemId: e.itemId })),
    });
});

// @desc    Add an item to the wishlist (idempotent)
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
    const { itemType, itemId } = req.body;
    if (!VALID_TYPES.includes(itemType) || !itemId) {
        res.status(400);
        throw new Error('Valid itemType (product|pandit) and itemId are required');
    }

    const user = await User.findById(req.user._id);
    const exists = user.wishlist.some((e) => e.itemType === itemType && String(e.itemId) === String(itemId));
    if (!exists) {
        user.wishlist.push({ itemType, itemId });
        await user.save();
    }

    res.status(201).json({ keys: user.wishlist.map((e) => ({ itemType: e.itemType, itemId: e.itemId })) });
});

// @desc    Remove an item from the wishlist
// @route   DELETE /api/wishlist/:itemType/:itemId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
    const { itemType, itemId } = req.params;
    const user = await User.findById(req.user._id);
    user.wishlist = user.wishlist.filter((e) => !(e.itemType === itemType && String(e.itemId) === String(itemId)));
    await user.save();
    res.json({ keys: user.wishlist.map((e) => ({ itemType: e.itemType, itemId: e.itemId })) });
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };

const mongoose = require('mongoose');
const Review = require('../models/Review');

// Recompute an item's displayed rating/numReviews as a deterministic blend of the
// admin seed (seedRating × seedReviews) and the real user reviews for that item.
//   total = seedReviews + reviewCount
//   rating = total ? (seedRating*seedReviews + reviewSum) / total : seedRating
// itemTypeName must be 'Product' or 'Pandit' (matches Review.itemType).
async function recomputeRating(Model, itemId, itemTypeName) {
    const item = await Model.findById(itemId);
    if (!item) return null;

    const agg = await Review.aggregate([
        { $match: { itemType: itemTypeName, itemId: new mongoose.Types.ObjectId(String(itemId)) } },
        { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: '$rating' } } },
    ]);
    const reviewCount = agg[0]?.count || 0;
    const reviewSum = agg[0]?.sum || 0;

    const seedRating = Number(item.seedRating) || 0;
    const seedReviews = Number(item.seedReviews) || 0;
    const total = seedReviews + reviewCount;
    const rating = total > 0
        ? Math.round(((seedRating * seedReviews + reviewSum) / total) * 10) / 10
        : seedRating;

    item.rating = rating;
    item.numReviews = total;
    await item.save();
    return item;
}

module.exports = { recomputeRating };

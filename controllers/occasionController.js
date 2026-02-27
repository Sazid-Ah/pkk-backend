const asyncHandler = require('express-async-handler');
const Occasion = require('../models/Occasion');

// @desc    Get all occasions
// @route   GET /api/occasions
// @access  Public
const getOccasions = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0;
    const skip = (page - 1) * limit;

    const occasions = await Occasion.find({})
        .skip(skip)
        .limit(limit);

    res.json(occasions);
});

// @desc    Create an occasion
// @route   POST /api/occasions
// @access  Private/Admin
const createOccasion = asyncHandler(async (req, res) => {
    const { name, englishName, icon, image, gradient } = req.body;

    const occasion = await Occasion.create({
        name,
        englishName,
        icon,
        image,
        gradient,
    });

    res.status(201).json(occasion);
});

// @desc    Update an occasion
// @route   PUT /api/occasions/:id
// @access  Private/Admin
const updateOccasion = asyncHandler(async (req, res) => {
    const occasion = await Occasion.findById(req.params.id);

    if (occasion) {
        occasion.name = req.body.name || occasion.name;
        occasion.englishName = req.body.englishName || occasion.englishName;
        occasion.icon = req.body.icon || occasion.icon;
        occasion.image = req.body.image || occasion.image;
        occasion.gradient = req.body.gradient || occasion.gradient;

        const updatedOccasion = await occasion.save();
        res.json(updatedOccasion);
    } else {
        res.status(404);
        throw new Error('Occasion not found');
    }
});

// @desc    Delete an occasion
// @route   DELETE /api/occasions/:id
// @access  Private/Admin
const deleteOccasion = asyncHandler(async (req, res) => {
    const occasion = await Occasion.findById(req.params.id);

    if (occasion) {
        await occasion.deleteOne();
        res.json({ message: 'Occasion removed' });
    } else {
        res.status(404);
        throw new Error('Occasion not found');
    }
});

module.exports = {
    getOccasions,
    createOccasion,
    updateOccasion,
    deleteOccasion,
};

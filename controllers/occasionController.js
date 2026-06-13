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

    // Validate required fields
    if (!name || !name.trim()) {
        res.status(400);
        throw new Error('Name is required');
    }
    if (!englishName || !englishName.trim()) {
        res.status(400);
        throw new Error('English name is required');
    }

    try {
        const occasion = await Occasion.create({
            name: name.trim(),
            englishName: englishName.trim(),
            icon: icon || '📅',
            image: image || '',
            gradient: gradient || ['#FF6B6B', '#C92A2A'],
        });

        res.status(201).json(occasion);
    } catch (error) {
        console.error('Occasion creation error:', error);
        if (error.name === 'ValidationError') {
            res.status(400);
            throw new Error(Object.values(error.errors).map(e => e.message).join(', '));
        }
        throw error;
    }
});

// @desc    Update an occasion
// @route   PUT /api/occasions/:id
// @access  Private/Admin
const updateOccasion = asyncHandler(async (req, res) => {
    const occasion = await Occasion.findById(req.params.id);

    if (!occasion) {
        res.status(404);
        throw new Error('Occasion not found');
    }

    // Validate required fields if provided
    if (req.body.name !== undefined && !req.body.name.trim()) {
        res.status(400);
        throw new Error('Name cannot be empty');
    }
    if (req.body.englishName !== undefined && !req.body.englishName.trim()) {
        res.status(400);
        throw new Error('English name cannot be empty');
    }

    try {
        occasion.name = req.body.name?.trim() || occasion.name;
        occasion.englishName = req.body.englishName?.trim() || occasion.englishName;
        occasion.icon = req.body.icon || occasion.icon;
        occasion.image = req.body.image !== undefined ? req.body.image : occasion.image;
        occasion.gradient = req.body.gradient || occasion.gradient;

        const updatedOccasion = await occasion.save();
        res.json(updatedOccasion);
    } catch (error) {
        console.error('Occasion update error:', error);
        if (error.name === 'ValidationError') {
            res.status(400);
            throw new Error(Object.values(error.errors).map(e => e.message).join(', '));
        }
        throw error;
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

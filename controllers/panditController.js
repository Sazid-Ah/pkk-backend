const asyncHandler = require('express-async-handler');
const Pandit = require('../models/Pandit');

// @desc    Get all pandits
// @route   GET /api/pandits
// @access  Public
const getPandits = asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;

    let query = {};

    if (lat && lng) {
        query.location = {
            $nearSphere: {
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: 50000 // 50km radius, adjustable
            }
        };
    }

    const pandits = await Pandit.find(query);
    res.json(pandits);
});

// @desc    Create a pandit
// @route   POST /api/pandits
// @access  Private/Admin
const createPandit = asyncHandler(async (req, res) => {
    const { name, specialty, rating, price, image, occasions, address, latitude, longitude } = req.body;

    let location = undefined;
    if (latitude && longitude) {
        location = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
    }

    const pandit = await Pandit.create({
        name,
        specialty,
        rating,
        price,
        image,
        occasions,
        address,
        ...(location && { location })
    });

    res.status(201).json(pandit);
});

// @desc    Update a pandit
// @route   PUT /api/pandits/:id
// @access  Private/Admin
const updatePandit = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id);

    if (pandit) {
        pandit.name = req.body.name || pandit.name;
        pandit.specialty = req.body.specialty || pandit.specialty;
        pandit.rating = req.body.rating || pandit.rating;
        pandit.price = req.body.price || pandit.price;
        pandit.image = req.body.image || pandit.image;
        pandit.occasions = req.body.occasions || pandit.occasions;
        if (req.body.address !== undefined) pandit.address = req.body.address;

        if (req.body.latitude && req.body.longitude) {
            pandit.location = {
                type: 'Point',
                coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
            };
        }

        const updatedPandit = await pandit.save();
        res.json(updatedPandit);
    } else {
        res.status(404);
        throw new Error('Pandit not found');
    }
});

// @desc    Delete a pandit
// @route   DELETE /api/pandits/:id
// @access  Private/Admin
const deletePandit = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id);

    if (pandit) {
        await pandit.deleteOne();
        res.json({ message: 'Pandit removed' });
    } else {
        res.status(404);
        throw new Error('Pandit not found');
    }
});

module.exports = {
    getPandits,
    createPandit,
    updatePandit,
    deletePandit,
};

const asyncHandler = require('express-async-handler');
const Pandit = require('../models/Pandit');
const { getNearbyPandits, searchPanditsNearby, haversineDistance, formatDistance } = require('../utils/distanceCalculator');

// @desc    Get all pandits
// @route   GET /api/pandits
// @access  Public
const getPandits = asyncHandler(async (req, res) => {
    const pandits = await Pandit.find({})
        .populate('occasions');
    res.json(pandits);
});

// @desc    Get nearby pandits based on user location
// @route   GET /api/pandits/nearby?latitude={lat}&longitude={lng}&radius={km}
// @access  Public
const getNearby = asyncHandler(async (req, res) => {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
        res.status(400);
        throw new Error('Latitude and longitude are required');
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const maxRadius = radius ? parseFloat(radius) : 15; // Default 15km

    if (isNaN(lat) || isNaN(lng)) {
        res.status(400);
        throw new Error('Invalid latitude or longitude');
    }

    const pandits = await getNearbyPandits(Pandit, lat, lng, maxRadius);
    res.json(pandits);
});

// @desc    Search pandits with location bias
// @route   GET /api/pandits/search?query={query}&latitude={lat}&longitude={lng}&radius={km}
// @access  Public
const searchWithLocation = asyncHandler(async (req, res) => {
    const { query, latitude, longitude, radius } = req.query;

    if (!query) {
        res.status(400);
        throw new Error('Search query is required');
    }

    if (!latitude || !longitude) {
        res.status(400);
        throw new Error('Latitude and longitude are required');
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const maxRadius = radius ? parseFloat(radius) : 15;

    if (isNaN(lat) || isNaN(lng)) {
        res.status(400);
        throw new Error('Invalid latitude or longitude');
    }

    const pandits = await searchPanditsNearby(Pandit, query, lat, lng, maxRadius);
    res.json(pandits);
});

// @desc    Get single pandit with distance
// @route   GET /api/pandits/:id?latitude={lat}&longitude={lng}
// @access  Public
const getPandit = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id)
        .populate('occasions');

    if (!pandit) {
        res.status(404);
        throw new Error('Pandit not found');
    }

    // Calculate distance if coordinates provided
    if (req.query.latitude && req.query.longitude) {
        const lat = parseFloat(req.query.latitude);
        const lng = parseFloat(req.query.longitude);

        if (!isNaN(lat) && !isNaN(lng) && pandit.location && pandit.location.coordinates) {
            const panditLat = pandit.location.coordinates.coordinates[1];
            const panditLon = pandit.location.coordinates.coordinates[0];
            const distance = haversineDistance(lat, lng, panditLat, panditLon);

            return res.json({
                ...pandit.toObject(),
                distance,
                distanceFormatted: formatDistance(distance)
            });
        }
    }

    res.json(pandit);
});

// @desc    Create a pandit
// @route   POST /api/pandits
// @access  Private/Admin
const createPandit = asyncHandler(async (req, res) => {
    const {
        name,
        specialty,
        rating,
        price,
        image,
        occasions,
        location,
        availableRadius,
        experience,
        bio,
        languages,
        specializations,
        phone,
        isVerified
    } = req.body;

    if (!location || !location.coordinates) {
        res.status(400);
        throw new Error('Location with coordinates is required');
    }

    // Validate coordinates format [longitude, latitude]
    if (
        !Array.isArray(location.coordinates.coordinates) ||
        location.coordinates.coordinates.length !== 2
    ) {
        res.status(400);
        throw new Error('Coordinates must be in [longitude, latitude] format');
    }

    const pandit = await Pandit.create({
        name,
        specialty,
        rating,
        price,
        image,
        occasions,
        location,
        availableRadius,
        experience,
        bio,
        languages,
        specializations,
        phone,
        isVerified
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
        pandit.rating = req.body.rating !== undefined ? req.body.rating : pandit.rating;
        pandit.price = req.body.price || pandit.price;
        pandit.image = req.body.image || pandit.image;
        pandit.occasions = req.body.occasions || pandit.occasions;

        // Update geolocation fields if provided
        if (req.body.location) {
            pandit.location = {
                ...pandit.location,
                ...req.body.location
            };
        }

        if (req.body.availableRadius !== undefined) {
            pandit.availableRadius = req.body.availableRadius;
        }

        pandit.experience = req.body.experience !== undefined ? req.body.experience : pandit.experience;
        pandit.bio = req.body.bio || pandit.bio;
        pandit.languages = req.body.languages || pandit.languages;
        pandit.specializations = req.body.specializations || pandit.specializations;
        pandit.phone = req.body.phone || pandit.phone;
        pandit.isVerified = req.body.isVerified !== undefined ? req.body.isVerified : pandit.isVerified;

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
    getNearby,
    searchWithLocation,
    getPandit,
    createPandit,
    updatePandit,
    deletePandit,
};

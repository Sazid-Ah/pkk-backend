const asyncHandler = require('express-async-handler');
const Pandit = require('../models/Pandit');
const bcrypt = require('bcryptjs');

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

    const pandits = await Pandit.find(query).populate('occasions');
    res.json(pandits);
});

// @desc    Create a pandit
// @route   POST /api/pandits
// @access  Private/Admin
const createPandit = asyncHandler(async (req, res) => {
    const { name, username, password, specialty, languages, about, rating, price, image, occasions, address, latitude, longitude } = req.body;

    let location = undefined;
    if (latitude && longitude) {
        location = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
    }

    if (!username || !password) {
        res.status(400);
        throw new Error('Please provide both username and password for the Pandit');
    }

    // Check if username already exists
    const existingPandit = await Pandit.findOne({ username });
    if (existingPandit) {
        res.status(400);
        throw new Error('Username already exists in Pandit collection');
    }

    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const pandit = await Pandit.create({
        name,
        username,
        password: hashedPassword,
        specialty,
        languages,
        about,
        rating,
        price,
        image,
        occasions,
        address,
        ...(location && { location })
    });

    res.status(201).json(await pandit.populate('occasions'));
});

// @desc    Update a pandit
// @route   PUT /api/pandits/:id
// @access  Private/Admin
const updatePandit = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id);

    if (pandit) {
        if (req.body.username && req.body.username !== pandit.username) {
            const existingPandit = await Pandit.findOne({ username: req.body.username });
            if (existingPandit) {
                res.status(400);
                throw new Error('Username already exists');
            }
            pandit.username = req.body.username;
        }

        if (req.body.password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            pandit.password = await bcrypt.hash(req.body.password, salt);
        }

        pandit.name = req.body.name || pandit.name;
        pandit.specialty = req.body.specialty || pandit.specialty;
        pandit.languages = req.body.languages || pandit.languages;
        if (req.body.about !== undefined) pandit.about = req.body.about;
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
        res.json(await updatedPandit.populate('occasions'));
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

// @desc    Get logged-in Pandit's own profile
// @route   GET /api/pandits/me
// @access  Private/Pandit
const getPanditProfile = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.user._id).select('-password').populate('occasions');
    if (!pandit) {
        res.status(404);
        throw new Error('Pandit not found');
    }
    res.json(pandit);
});

// @desc    Pandit updates their own profile (bio, languages, about)
// @route   PUT /api/pandits/me
// @access  Private/Pandit
const updatePanditProfile = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.user._id);
    if (!pandit) {
        res.status(404);
        throw new Error('Pandit not found');
    }

    // Pandits can only update these fields (not price, specialty, name)
    if (req.body.about !== undefined) pandit.about = req.body.about;
    if (req.body.languages) {
        pandit.languages = Array.isArray(req.body.languages)
            ? req.body.languages
            : req.body.languages.split(',').map(l => l.trim()).filter(l => l);
    }

    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        pandit.password = await bcrypt.hash(req.body.password, salt);
    }

    const updated = await pandit.save();
    const result = updated.toObject();
    delete result.password;
    res.json(result);
});

module.exports = {
    getPandits,
    createPandit,
    updatePandit,
    deletePandit,
    getPanditProfile,
    updatePanditProfile,
};

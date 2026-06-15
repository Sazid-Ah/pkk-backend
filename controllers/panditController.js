const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');

let Pandit;
try {
    Pandit = require('../models/Pandit');
} catch (error) {
    console.error('Failed to load Pandit model:', error.message);
    throw error;
}

const Booking = require('../models/Booking');

// @desc    Get all pandits
// @route   GET /api/pandits
// @access  Public
const getPandits = asyncHandler(async (req, res) => {
    const { lat, lng, sort, occasionId } = req.query;

    let query = {};
    if (occasionId) {
        query.occasions = occasionId;
    }
    let sortQuery = {};

    if (lat && lng && sort !== 'rating') {
        // Default proximity sort (within 50km)
        query.location = {
            $nearSphere: {
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: 50000 // 50km radius
            }
        };
    }

    if (sort === 'rating') {
        sortQuery = { rating: -1, isFeatured: -1 };
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const pandits = await Pandit.find(query)
        .populate('occasions')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);

    res.json(pandits);
});

// @desc    Create a pandit
// @route   POST /api/pandits
// @access  Private/Admin
const createPandit = asyncHandler(async (req, res) => {
    const { name, username, password, specialty, languages, about, rating, price, image, occasions, address, latitude, longitude, experience, isVerified } = req.body;

    // Validate required fields
    if (!name || !name.toString().trim()) {
        res.status(400);
        throw new Error('Name is required');
    }
    if (!specialty || !specialty.toString().trim()) {
        res.status(400);
        throw new Error('Specialty is required');
    }
    if (!price || !price.toString().trim()) {
        res.status(400);
        throw new Error('Price is required');
    }

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const panditData = {
        name: String(name).trim(),
        username: String(username).trim(),
        password: hashedPassword,
        specialty: String(specialty).trim(),
        languages: Array.isArray(languages) ? languages : (languages ? String(languages).split(',').map(l => l.trim()).filter(l => l) : []),
        about: about ? String(about) : '',
        rating: rating ? Number(rating) : 0,
        price: String(price).trim(),
        image: image ? String(image) : '',
        occasions: occasions || [],
        address: address ? String(address) : '',
        experience: experience !== undefined ? Number(experience) : 0,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
        ...(location && { location })
    };

    try {
      const pandit = await Pandit.create(panditData);
      res.status(201).json(await pandit.populate('occasions'));
    } catch (err) {
      console.error('Pandit creation error:', err);
      res.status(500).json({ message: err.message, stack: err.stack });
    }
});

// @desc    Update a pandit
// @route   PUT /api/pandits/:id
// @access  Private/Admin
const updatePandit = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id);

    if (!pandit) {
        res.status(404);
        throw new Error('Pandit not found');
    }

    if (req.body.username && req.body.username !== pandit.username) {
        const existingPandit = await Pandit.findOne({ username: req.body.username });
        if (existingPandit) {
            res.status(400);
            throw new Error('Username already exists');
        }
        pandit.username = String(req.body.username).trim();
    }

    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        pandit.password = await bcrypt.hash(req.body.password, salt);
    }

    if (req.body.name) pandit.name = String(req.body.name).trim();
    if (req.body.specialty) pandit.specialty = String(req.body.specialty).trim();
    if (req.body.languages) {
        pandit.languages = Array.isArray(req.body.languages) 
            ? req.body.languages 
            : String(req.body.languages).split(',').map(l => l.trim()).filter(l => l);
    }
    if (req.body.about !== undefined) pandit.about = req.body.about;
    // Admin can manually set rating and numReviews
    if (req.body.rating !== undefined) pandit.rating = Number(req.body.rating);
    if (req.body.numReviews !== undefined) pandit.numReviews = Number(req.body.numReviews);
    if (req.body.price) pandit.price = String(req.body.price).trim();
    if (req.body.image !== undefined) pandit.image = req.body.image ? String(req.body.image) : '';
    if (req.body.occasions) pandit.occasions = req.body.occasions;
    if (req.body.address !== undefined) pandit.address = req.body.address;
    if (req.body.experience !== undefined) pandit.experience = Number(req.body.experience);
    if (req.body.isVerified !== undefined) pandit.isVerified = Boolean(req.body.isVerified);
    if (req.body.isFeatured !== undefined) pandit.isFeatured = req.body.isFeatured;

    if (req.body.latitude && req.body.longitude) {
        pandit.location = {
            type: 'Point',
            coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
        };
    }

    const updatedPandit = await pandit.save();
    res.json(await updatedPandit.populate('occasions'));
});

// @desc    Delete a pandit
// @route   DELETE /api/pandits/:id
// @access  Private/Admin
const deletePandit = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id);

    if (pandit) {
        // Cancel any pending/confirmed bookings before removing the pandit
        await Booking.updateMany(
            { pandit: pandit._id, status: { $in: ['Pending', 'Confirmed'] } },
            { status: 'Cancelled', notes: 'Pandit account removed' }
        );
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

// @desc    Get public stats for a pandit (completed bookings count)
// @route   GET /api/pandits/:id/stats
// @access  Public
const getPanditStats = asyncHandler(async (req, res) => {
    const pujasCompleted = await Booking.countDocuments({ pandit: req.params.id, status: 'Completed' });
    res.json({ pujasCompleted });
});

module.exports = {
    getPandits,
    createPandit,
    updatePandit,
    deletePandit,
    getPanditProfile,
    updatePanditProfile,
    getPanditStats,
};

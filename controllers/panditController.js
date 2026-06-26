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
const { recomputeRating } = require('../utils/ratingUtils');

// Keep `mrp` only when it's a genuine markdown above the displayed (minimum) price.
function normalizeMrp(mrp, basePrice) {
    if (mrp === undefined || mrp === null || mrp === '') return null;
    const m = Number(mrp);
    if (isNaN(m) || !basePrice || m <= Number(basePrice)) return null;
    return m;
}

// Parse a price string like "₹2000-5000" or "2000" into { priceMin, priceMax }
function parsePriceRange(priceStr) {
    if (!priceStr) return { priceMin: null, priceMax: null };
    const digits = String(priceStr).replace(/[^\d\-]/g, '');
    const parts = digits.split('-').map(Number).filter((n) => !isNaN(n) && n > 0);
    if (parts.length >= 2) return { priceMin: parts[0], priceMax: parts[1] };
    if (parts.length === 1) return { priceMin: parts[0], priceMax: parts[0] };
    return { priceMin: null, priceMax: null };
}

// Escape a user-supplied string for safe use inside a RegExp (state filter).
function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normalize the per-occasion `services` array from a request and derive the
// backward-compatible fields (occasions, priceMin/priceMax, price). Returns null
// when no valid service rows are present, so callers can fall back to the legacy
// single-price path. Throws (400) on malformed rows.
function buildServiceData(rawServices, res) {
    if (!Array.isArray(rawServices) || rawServices.length === 0) return null;

    const services = [];
    for (const row of rawServices) {
        if (!row) continue;
        const occasion = row.occasion || row.occasionId || row._id;
        if (!occasion) {
            res.status(400);
            throw new Error('Each service must reference an occasion');
        }
        const price = Number(row.price);
        if (isNaN(price) || price < 0) {
            res.status(400);
            throw new Error('Each service must have a valid price');
        }
        services.push({
            occasion,
            price,
            mrp: normalizeMrp(row.mrp, price),
        });
    }

    if (services.length === 0) return null;

    const prices = services.map((s) => s.price);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    return {
        services,
        occasions: services.map((s) => s.occasion),
        priceMin,
        priceMax,
        // Display string used on cards / for sorting; "from ₹<min>".
        price: `₹${priceMin}`,
    };
}

// @desc    Get all pandits
// @route   GET /api/pandits
// @access  Public
const getPandits = asyncHandler(async (req, res) => {
    const { lat, lng, sort, occasionId, state } = req.query;

    let query = {};
    if (occasionId) {
        query.occasions = occasionId;
    }
    // Restrict to a client's state (case-insensitive exact match). Combines fine
    // with the $nearSphere distance sort below — pandits are sorted by distance
    // *within* the selected state.
    if (state && String(state).trim()) {
        query.state = new RegExp(`^${escapeRegex(String(state).trim())}$`, 'i');
    }
    let sortQuery = {};

    if (lat && lng && sort !== 'rating') {
        // Sort by proximity to the user's location — nearest first. No
        // $maxDistance: we never exclude anyone, so far pandits still load
        // (just lower down the list) instead of disappearing.
        query.location = {
            $nearSphere: {
                $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                }
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
        .populate('services.occasion', 'name englishName image translations')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);

    res.json(pandits);
});

// @desc    Create a pandit
// @route   POST /api/pandits
// @access  Private/Admin
const createPandit = asyncHandler(async (req, res) => {
    const { name, username, password, specialty, languages, about, price, image, occasions, services, state, address, latitude, longitude, experience, isVerified, mrp, seedRating, seedReviews } = req.body;

    // Per-occasion pricing (preferred). Falls back to the legacy single price.
    const serviceData = buildServiceData(services, res);

    // Validate required fields
    if (!name || !name.toString().trim()) {
        res.status(400);
        throw new Error('Name is required');
    }
    if (!specialty || !specialty.toString().trim()) {
        res.status(400);
        throw new Error('Specialty is required');
    }
    if (!serviceData && (!price || !price.toString().trim())) {
        res.status(400);
        throw new Error('Add at least one service with a price');
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

    // Pricing/occasions: prefer the derived per-service data; otherwise legacy single price.
    const priceFields = serviceData
        ? {
            services: serviceData.services,
            occasions: serviceData.occasions,
            price: serviceData.price,
            priceMin: serviceData.priceMin,
            priceMax: serviceData.priceMax,
            mrp: null,
        }
        : (() => {
            const priceStr = String(price).trim();
            const priceRange = parsePriceRange(priceStr);
            return {
                price: priceStr,
                ...priceRange,
                mrp: normalizeMrp(mrp, priceRange.priceMin),
                occasions: occasions || [],
            };
        })();

    // Admin's initial rating (seed); no user reviews yet, so displayed = seed.
    const sRating = Math.min(5, Math.max(0, Number(seedRating) || 0));
    const sReviews = Math.max(0, Number(seedReviews) || 0);
    const panditData = {
        name: String(name).trim(),
        username: String(username).trim(),
        password: hashedPassword,
        specialty: String(specialty).trim(),
        languages: Array.isArray(languages) ? languages : (languages ? String(languages).split(',').map(l => l.trim()).filter(l => l) : []),
        about: about ? String(about) : '',
        seedRating: sRating,
        seedReviews: sReviews,
        rating: sRating,
        numReviews: sReviews,
        ...priceFields,
        image: image ? String(image) : '',
        state: state ? String(state).trim() : '',
        address: address ? String(address) : '',
        experience: experience !== undefined ? Number(experience) : 0,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
        ...(location && { location })
    };

    try {
      const pandit = await Pandit.create(panditData);
      await pandit.populate('occasions');
      await pandit.populate('services.occasion', 'name englishName image translations');
      res.status(201).json(pandit);
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
    // Admin sets the initial rating (seed); displayed rating is recomputed below.
    if (req.body.seedRating !== undefined) pandit.seedRating = Math.min(5, Math.max(0, Number(req.body.seedRating) || 0));
    if (req.body.seedReviews !== undefined) pandit.seedReviews = Math.max(0, Number(req.body.seedReviews) || 0);
    // Per-occasion pricing (preferred): derives occasions/price/priceMin/priceMax.
    const updatedServiceData = req.body.services !== undefined ? buildServiceData(req.body.services, res) : undefined;
    if (updatedServiceData) {
        pandit.services = updatedServiceData.services;
        pandit.occasions = updatedServiceData.occasions;
        pandit.price = updatedServiceData.price;
        pandit.priceMin = updatedServiceData.priceMin;
        pandit.priceMax = updatedServiceData.priceMax;
        pandit.mrp = null; // discounts now live per-service
    } else {
        // Legacy single-price path.
        if (req.body.price) {
            pandit.price = String(req.body.price).trim();
            Object.assign(pandit, parsePriceRange(pandit.price));
        }
        // Recompute compare-at price against the (possibly updated) minimum price.
        if (req.body.mrp !== undefined) {
            pandit.mrp = normalizeMrp(req.body.mrp, pandit.priceMin);
        } else if (pandit.mrp != null && (!pandit.priceMin || pandit.mrp <= pandit.priceMin)) {
            pandit.mrp = null;
        }
        if (req.body.occasions) pandit.occasions = req.body.occasions;
    }
    if (req.body.image !== undefined) pandit.image = req.body.image ? String(req.body.image) : '';
    if (req.body.state !== undefined) pandit.state = req.body.state ? String(req.body.state).trim() : '';
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

    await pandit.save();
    if (req.body.seedRating !== undefined || req.body.seedReviews !== undefined) {
        await recomputeRating(Pandit, pandit._id, 'Pandit');
    }
    const updatedPandit = await Pandit.findById(pandit._id)
        .populate('occasions')
        .populate('services.occasion', 'name englishName image translations');
    res.json(updatedPandit);
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
    const pandit = await Pandit.findById(req.user._id).select('-password').populate('occasions').populate('services.occasion', 'name englishName image translations');
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

// @desc    Get a single pandit by ID (public profile)
// @route   GET /api/pandits/:id
// @access  Public
const getPanditById = asyncHandler(async (req, res) => {
    const pandit = await Pandit.findById(req.params.id)
        .select('-password -refreshToken -loginHistory')
        .populate('occasions', 'name image')
        .populate('services.occasion', 'name englishName image translations');
    if (!pandit) {
        res.status(404);
        throw new Error('Pandit not found');
    }
    res.json(pandit);
});

module.exports = {
    getPandits,
    getPanditById,
    createPandit,
    updatePandit,
    deletePandit,
    getPanditProfile,
    updatePanditProfile,
    getPanditStats,
};

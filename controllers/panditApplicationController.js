const asyncHandler = require('express-async-handler');
const PanditApplication = require('../models/PanditApplication');

// @desc    Submit a pandit application
// @route   POST /api/pandit-applications
// @access  Public
const createApplication = asyncHandler(async (req, res) => {
    const { name, email, phone, city, specialty, experience, bio } = req.body;
    if (!name || !email || !phone) {
        res.status(400);
        throw new Error('Name, email and phone are required');
    }
    const application = await PanditApplication.create({
        name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        city: city ? String(city).trim() : '',
        specialty: specialty ? String(specialty).trim() : '',
        experience: Number(experience) || 0,
        bio: bio ? String(bio).trim() : '',
    });
    res.status(201).json({ message: 'Application submitted', id: application._id });
});

// @desc    List pandit applications (optionally filtered by status)
// @route   GET /api/pandit-applications
// @access  Private/Admin
const getApplications = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    const applications = await PanditApplication.find(query).sort({ createdAt: -1 });
    res.json(applications);
});

// @desc    Update an application's status
// @route   PUT /api/pandit-applications/:id/status
// @access  Private/Admin
const updateApplicationStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
        res.status(400);
        throw new Error('Invalid status');
    }
    const application = await PanditApplication.findById(req.params.id);
    if (!application) {
        res.status(404);
        throw new Error('Application not found');
    }
    application.status = status;
    const updated = await application.save();
    res.json(updated);
});

// @desc    Delete an application
// @route   DELETE /api/pandit-applications/:id
// @access  Private/Admin
const deleteApplication = asyncHandler(async (req, res) => {
    const application = await PanditApplication.findById(req.params.id);
    if (!application) {
        res.status(404);
        throw new Error('Application not found');
    }
    await application.deleteOne();
    res.json({ message: 'Application removed' });
});

module.exports = { createApplication, getApplications, updateApplicationStatus, deleteApplication };

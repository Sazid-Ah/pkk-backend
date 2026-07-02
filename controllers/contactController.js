const asyncHandler = require('express-async-handler');
const Contact = require('../models/Contact');
const { sendInquiryEmail } = require('../utils/emailService');
const { validateEmail, validatePhone } = require('../utils/validation');

// @desc    Submit a contact inquiry
// @route   POST /api/contact
// @access  Public
const submitInquiry = asyncHandler(async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        res.status(400);
        throw new Error('Please provide name, email, subject and message');
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        res.status(400);
        throw new Error(emailValidation.error);
    }

    if (phone) {
        const phoneValidation = validatePhone(String(phone));
        if (!phoneValidation.valid) {
            res.status(400);
            throw new Error(phoneValidation.error);
        }
    }

    try {
        // 1. Save to MongoDB
        const contact = await Contact.create({
            name,
            email,
            phone,
            subject,
            message
        });

        // 2. Send Email Notification
        // We pass the data regardless of if save worked, but usually we want both.
        // If we want to be strict, we check if(contact)
        await sendInquiryEmail({ name, email, phone, subject, message });
        
        res.status(200).json({
            success: true,
            message: 'Your inquiry has been sent successfully. We will get back to you soon.',
            data: contact // Return the saved contact for reference
        });
    } catch (error) {
        res.status(500);
        throw new Error('Failed to send inquiry. Please try again later.');
    }
});



const getContacted = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, from, to } = req.query;
    const skip = (page - 1) * limit;
    const query = {};

    if (status) query.status = status;
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
    }

    try {
        const contacted = await Contact.find(query).skip(skip).limit(parseInt(limit));
        const total = await Contact.countDocuments(query);

        res.status(200).json({
            success: true,
            data: contacted,
            total,
            pages: Math.ceil(total / limit),
            page: parseInt(page)
        });
    } catch (error) {
        res.status(500);
        throw new Error('Failed to fetch contacted. Please try again later.');
    }
});

const updateContactStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['new', 'read', 'replied', 'archived'];

    if (!status || !allowedStatuses.includes(status)) {
        res.status(400);
        throw new Error(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`);
    }

    const contact = await Contact.findById(id);
    if (!contact) {
        res.status(404);
        throw new Error('Contact inquiry not found');
    }

    contact.status = status;
    await contact.save();

    res.status(200).json({
        success: true,
        data: contact,
    });
});

module.exports = {
    submitInquiry,
    getContacted,
    updateContactStatus,
};

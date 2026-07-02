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
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    try {
        const contacted = await Contact.find().skip(skip).limit(parseInt(limit));
        const total = await Contact.countDocuments();

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

module.exports = {
    submitInquiry,
    getContacted
};

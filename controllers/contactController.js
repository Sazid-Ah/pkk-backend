const asyncHandler = require('express-async-handler');
const Contact = require('../models/Contact');
const { sendInquiryEmail } = require('../utils/emailService');

// @desc    Submit a contact inquiry
// @route   POST /api/contact
// @access  Public
const submitInquiry = asyncHandler(async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        res.status(400);
        throw new Error('Please provide name, email, subject and message');
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
        res.status(400);
        throw new Error('Please provide a valid email address');
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

module.exports = {
    submitInquiry
};

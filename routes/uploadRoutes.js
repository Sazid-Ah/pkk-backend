const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc   Upload an image
// @route  POST /api/upload
// @access Private/Admin — only admins should upload pandit/product images
router.post('/', protect, admin, upload.single('image'), (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    // Normalize backslashes to forward slashes for cross-platform URL compatibility
    const filePath = `/${req.file.path.replace(/\\/g, '/')}`;
    res.json({
        message: 'Image uploaded successfully',
        image: filePath,
    });
});

// Error handler for multer (file size, type errors)
router.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    if (err.message) {
        return res.status(400).json({ message: err.message });
    }
    next(err);
});

module.exports = router;

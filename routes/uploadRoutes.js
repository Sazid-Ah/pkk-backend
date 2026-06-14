const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

// Get GridFS bucket instance
let gfsBucket;
mongoose.connection.once('open', () => {
    gfsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
    });
});

// @desc    Upload an image to MongoDB GridFS
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'No image uploaded' });
    }

    if (!gfsBucket) {
        return res.status(500).send({ message: 'Database connection not ready for upload' });
    }

    // Create an upload stream to GridFS
    const filename = `${req.file.fieldname}-${Date.now()}-${req.file.originalname}`;
    const uploadStream = gfsBucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
    });

    // Write the buffer to the stream and end it
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', () => {
        res.send({
            message: 'Image uploaded successfully',
            image: `/api/upload/image/${uploadStream.id}`, // Return the new GridFS URL format
        });
    });

    uploadStream.on('error', (err) => {
        console.error('GridFS Upload Error:', err);
        res.status(500).send({ message: 'Upload stream error' });
    });
});

// @desc    Retrieve an image from MongoDB GridFS
// @route   GET /api/upload/image/:id
// @access  Public
router.get('/image/:id', async (req, res) => {
    try {
        if (!gfsBucket) {
            return res.status(500).send('Database connection not ready for retrieval');
        }

        const fileId = new ObjectId(req.params.id);

        // Find the file to get its content type
        const files = await gfsBucket.find({ _id: fileId }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'Image not found in database' });
        }

        // Set the content type header and force inline rendering
        res.setHeader('Content-Type', files[0].contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');

        // Stream the file back to the client
        const downloadStream = gfsBucket.openDownloadStream(fileId);
        downloadStream.pipe(res);

        downloadStream.on('error', (err) => {
            console.error('GridFS Download Default Error:', err);
            if (!res.headersSent) {
                res.status(404).json({ message: 'Error streaming image from database' });
            } else {
                res.end();
            }
        });

    } catch (error) {
        console.error('GridFS ID parsing Error:', error);
        res.status(400).json({ message: 'Invalid image ID format' });
    }
});

module.exports = router;

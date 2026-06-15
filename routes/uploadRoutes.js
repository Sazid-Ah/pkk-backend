const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const path = require('path');
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');

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
router.post('/', protect, uploadLimiter, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'No image uploaded' });
    }

    if (!gfsBucket) {
        return res.status(500).send({ message: 'Database connection not ready for upload' });
    }

    // Create an upload stream to GridFS and store original filename + content type in metadata
    const filename = `${req.file.fieldname}-${Date.now()}-${req.file.originalname}`;
    const uploadStream = gfsBucket.openUploadStream(filename, {
        metadata: {
            originalName: req.file.originalname,
            contentType: req.file.mimetype,
        },
    });

    // Write the buffer to the stream and end it
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', () => {
        // Return URL that includes the original extension so browsers and previews can infer type from path
        const ext = path.extname(req.file.originalname) || '';
        res.send({
            message: 'Image uploaded successfully',
            image: `/api/upload/image/${uploadStream.id}${ext}`,
        });
    });

    uploadStream.on('error', (err) => {
        console.error('GridFS Upload Error:', err);
        res.status(500).send({ message: 'Upload stream error' });
    });
});

// @desc    Retrieve an image from MongoDB GridFS (with extension suffix, e.g. /image/:id.png)
// @route   GET /api/upload/image/:id.:ext
// @access  Public
// IMPORTANT: this route must be defined BEFORE /image/:id so Express matches it first,
// because Express would otherwise capture the dot+extension as part of the :id param.
router.get('/image/:id.:ext', async (req, res) => {
    try {
        if (!gfsBucket) {
            return res.status(500).send('Database connection not ready for retrieval');
        }

        const fileId = new ObjectId(req.params.id);
        const files = await gfsBucket.find({ _id: fileId }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'Image not found in database' });
        }

        const fileDoc = files[0];
        const ext = path.extname(fileDoc.filename || fileDoc.metadata?.originalName || '')?.toLowerCase();
        const extToMime = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
        };
        const contentType = fileDoc.contentType || fileDoc.metadata?.contentType || extToMime[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        const filenameForHeader = fileDoc.metadata?.originalName || fileDoc.filename || `${fileId}${ext}`;
        res.setHeader('Content-Disposition', `inline; filename="${filenameForHeader}"`);

        const downloadStream = gfsBucket.openDownloadStream(fileId);
        downloadStream.pipe(res);

        downloadStream.on('error', (err) => {
            console.error('GridFS Download Dot-Ext Error:', err);
            if (!res.headersSent) {
                res.status(404).json({ message: 'Error streaming image from database' });
            } else {
                res.end();
            }
        });
    } catch (error) {
        console.error('GridFS ID parsing Error (dot-ext):', error);
        res.status(400).json({ message: 'Invalid image ID format' });
    }
});

// @desc    Retrieve an image from MongoDB GridFS (plain ObjectId, no extension)
// @route   GET /api/upload/image/:id
// @access  Public
router.get('/image/:id', async (req, res) => {
    try {
        if (!gfsBucket) {
            return res.status(500).send('Database connection not ready for retrieval');
        }
        const fileId = new ObjectId(req.params.id);

        const files = await gfsBucket.find({ _id: fileId }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'Image not found in database' });
        }

        const fileDoc = files[0];
        const ext = path.extname(fileDoc.filename || fileDoc.metadata?.originalName || '')?.toLowerCase();
        const extToMime = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
        };
        const contentType = fileDoc.contentType || fileDoc.metadata?.contentType || extToMime[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        const filenameForHeader = fileDoc.metadata?.originalName || fileDoc.filename || `${fileId}${ext}`;
        res.setHeader('Content-Disposition', `inline; filename="${filenameForHeader}"`);

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

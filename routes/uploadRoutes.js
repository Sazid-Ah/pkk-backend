const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

router.post('/', upload.single('image'), (req, res) => {
    res.send({
        message: 'Image uploaded',
        image: `/${req.file.path.replace(/\\/g, '/')}`,
    });
});

module.exports = router;

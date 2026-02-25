const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Use cryptographically random filename to prevent enumeration/overwriting
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        const randomName = crypto.randomBytes(12).toString('hex');
        cb(null, `${randomName}${path.extname(file.originalname).toLowerCase()}`);
    },
});

function checkFileType(file, cb) {
    const allowedExts = /jpg|jpeg|png|webp/;
    const allowedMimes = /image\/(jpeg|jpg|png|webp)/;
    const extValid = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimeValid = allowedMimes.test(file.mimetype);

    if (extValid && mimeValid) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'));
    }
}

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB max
    },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

module.exports = upload;

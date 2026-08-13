const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

function checkFileType(file, cb) {
    const filetypes = /jpg|jpeg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Images only!');
    }
}

// Vercel rejects any serverless request body over 4.5 MB at the platform edge,
// before Express ever sees it. The old 5 MB limit meant a 4.6 MB image failed with
// an opaque platform 413 that no application error handler could explain. Staying
// under the cap keeps rejection inside the app, where the message is ours.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const upload = multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

module.exports = upload;
module.exports.MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES;

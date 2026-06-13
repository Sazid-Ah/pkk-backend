const express = require('express');
const router = express.Router();
const {
    getGlobalSettings,
    updateGlobalSettings,
} = require('../controllers/globalSettingsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getGlobalSettings)
    .put(protect, admin, updateGlobalSettings);

module.exports = router;

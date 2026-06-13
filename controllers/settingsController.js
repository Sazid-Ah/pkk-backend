const asyncHandler = require('express-async-handler');
const UserSettings = require('../models/UserSettings');

const ALLOWED_THEMES = ['system', 'light', 'dark'];
const ALLOWED_LANGUAGES = ['en', 'hi', 'bn', 'te', 'ta', 'kn'];

// @desc   Get authenticated user's settings (creates defaults on first call)
// @route  GET /api/settings
// @access Private
const getSettings = asyncHandler(async (req, res) => {
    let settings = await UserSettings.findOne({ user: req.user._id });

    if (!settings) {
        settings = await UserSettings.create({ user: req.user._id });
    }

    res.json(settings);
});

// @desc   Update authenticated user's settings (partial updates supported)
// @route  PUT /api/settings
// @access Private
const updateSettings = asyncHandler(async (req, res) => {
    const { theme, language, notifications } = req.body;
    const patch = {};

    if (theme !== undefined) {
        if (!ALLOWED_THEMES.includes(theme)) {
            res.status(400);
            throw new Error(`Invalid theme. Allowed: ${ALLOWED_THEMES.join(', ')}`);
        }
        patch.theme = theme;
    }

    if (language !== undefined) {
        if (!ALLOWED_LANGUAGES.includes(language)) {
            res.status(400);
            throw new Error(`Invalid language. Allowed: ${ALLOWED_LANGUAGES.join(', ')}`);
        }
        patch.language = language;
    }

    if (notifications !== undefined) {
        if (typeof notifications !== 'object' || Array.isArray(notifications)) {
            res.status(400);
            throw new Error('notifications must be an object');
        }
        if (notifications.push !== undefined) {
            patch['notifications.push'] = Boolean(notifications.push);
        }
        if (notifications.orderUpdates !== undefined) {
            patch['notifications.orderUpdates'] = Boolean(notifications.orderUpdates);
        }
        if (notifications.promotionalEmails !== undefined) {
            patch['notifications.promotionalEmails'] = Boolean(notifications.promotionalEmails);
        }
    }

    if (Object.keys(patch).length === 0) {
        res.status(400);
        throw new Error('No valid fields provided');
    }

    const settings = await UserSettings.findOneAndUpdate(
        { user: req.user._id },
        { $set: patch },
        { new: true, upsert: true, runValidators: true }
    );

    res.json(settings);
});

module.exports = { getSettings, updateSettings };

const express = require('express');
const router = express.Router();
const { setupAdmin } = require('../controllers/setupController');

// POST /api/setup/admin
// Creates the initial admin account. Blocked once an admin exists.
router.post('/admin', setupAdmin);

module.exports = router;

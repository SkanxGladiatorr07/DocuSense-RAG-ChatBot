const express = require('express');
const { register } = require('../controllers/authController');

const router = express.Router();

// Route: POST /api/v1/auth/register
router.post('/register', register);

module.exports = router;

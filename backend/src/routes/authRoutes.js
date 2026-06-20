const express = require('express');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// Route: POST /api/v1/auth/register
router.post('/register', register);

// Route: POST /api/v1/auth/login
router.post('/login', login);

module.exports = router;

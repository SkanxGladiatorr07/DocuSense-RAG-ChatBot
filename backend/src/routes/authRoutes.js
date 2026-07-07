const express = require('express');
const { register, login, getMe, updateProfile } = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const authorise = require('../middleware/authorise');

const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// ── Protected routes (require valid JWT) ──────────────────────────────────────
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

// ── Admin-only route example ──────────────────────────────────────────────────
router.get('/admin-check', authenticate, authorise('admin'), (req, res) => {
  res.json({ success: true, message: `Welcome, Admin ${req.user.name}!` });
});

module.exports = router;


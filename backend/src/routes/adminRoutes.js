/**
 * @file routes/adminRoutes.js
 * @description Administration routes.
 *
 *   Base path (mounted in routes/index.js)   : /api/v1/admin
 *   Alias (mounted in app.js for compatibility): /api/admin
 *
 *   ┌────────┬─────────────┬─────────────────┬───────────────────────────────────────────┐
 *   │ Method │ Path        │ Middleware      │ Description                               │
 *   ├────────┼─────────────┼─────────────────┼───────────────────────────────────────────┤
 *   │ GET    │ /dashboard  │ authenticate,   │ Fetch system-wide dashboard statistics    │
 *   │        │             │ authorise('admin')│ for admin overview                      │
 *   └────────┴─────────────┴─────────────────┴───────────────────────────────────────────┘
 */

const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorise = require('../middleware/authorise');
const { getDashboardAnalytics } = require('../controllers/adminController');

const router = express.Router();

// ── GET /dashboard — system-wide statistics (admin only) ──────────────────────
router.get(
  '/dashboard',
  authenticate,
  authorise('admin'),
  getDashboardAnalytics
);

module.exports = router;

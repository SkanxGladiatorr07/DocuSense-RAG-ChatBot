/**
 * @file routes/testRoutes.js
 * @description RBAC validation test routes.
 *
 *   Mounted at /api/v1/test
 *   Intended for development / integration testing — verify that the
 *   authentication and authorisation middleware stack works end-to-end
 *   before wiring real feature routes.
 *
 *   Routes:
 *   ┌─────────────────────────┬──────────────────────────────────────────────┐
 *   │ GET /api/v1/test/public    │ No auth — anyone can access               │
 *   │ GET /api/v1/test/protected │ Valid JWT required (any role)              │
 *   │ GET /api/v1/test/admin     │ Valid JWT + role === 'admin' required      │
 *   └─────────────────────────┴──────────────────────────────────────────────┘
 */

const express = require('express');

const authenticate = require('../middleware/authenticate');
const authorise    = require('../middleware/authorise');
const { successResponse } = require('../utils/ApiResponse');

const router = express.Router();

// ── GET /api/v1/test/public ──────────────────────────────────────────────────
// Accessible by anyone — no token required.
router.get('/public', (req, res) => {
  successResponse(res, 200, 'Public route — no authentication required.', {
    route: 'public',
    access: 'everyone',
  });
});

// ── GET /api/v1/test/protected ───────────────────────────────────────────────
// Requires a valid JWT.  Any authenticated user (any role) is allowed.
router.get('/protected', authenticate, (req, res) => {
  successResponse(res, 200, 'Protected route — authentication verified.', {
    route: 'protected',
    access: 'authenticated users',
    user: {
      id:    req.user._id,
      name:  req.user.name,
      email: req.user.email,
      role:  req.user.role,
    },
  });
});

// ── GET /api/v1/test/admin ───────────────────────────────────────────────────
// Requires a valid JWT AND role === 'admin'.
router.get('/admin', authenticate, authorise('admin'), (req, res) => {
  successResponse(res, 200, 'Admin route — role authorisation verified.', {
    route: 'admin',
    access: 'admin role only',
    user: {
      id:    req.user._id,
      name:  req.user.name,
      email: req.user.email,
      role:  req.user.role,
    },
  });
});

module.exports = router;

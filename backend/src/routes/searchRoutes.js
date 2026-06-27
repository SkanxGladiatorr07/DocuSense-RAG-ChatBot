/**
 * @file routes/searchRoutes.js
 * @description Semantic search routes.
 *
 *   Base path (mounted in routes/index.js): /api/v1/search
 *
 *   ┌────────┬───────────┬──────────────────┬──────────────────────────────────────┐
 *   │ Method │ Path      │ Middleware        │ Description                          │
 *   ├────────┼───────────┼──────────────────┼──────────────────────────────────────┤
 *   │ POST   │ /retrieve │ authenticate      │ Embed question, retrieve top-K chunks │
 *   └────────┴───────────┴──────────────────┴──────────────────────────────────────┘
 */

const express        = require('express');
const authenticate   = require('../middleware/authenticate');
const { retrieveChunks } = require('../controllers/searchController');

const router = express.Router();

// ── POST /retrieve ────────────────────────────────────────────────────────────
//
//   Middleware chain:
//   1. authenticate    — verifies JWT, attaches req.user
//   2. retrieveChunks  — embeds question, finds similar chunks, returns results
//
router.post('/retrieve', authenticate, retrieveChunks);

module.exports = router;

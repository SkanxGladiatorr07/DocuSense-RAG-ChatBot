/**
 * @file routes/chatRoutes.js
 * @description Chat (RAG Q&A) routes.
 *
 *   Base path (mounted in routes/index.js): /api/v1/chat
 *   Alias (mounted in app.js)            : /api/chat
 *
 *   ┌────────┬──────┬──────────────┬────────────────────────────────────────────┐
 *   │ Method │ Path │ Middleware   │ Description                                │
 *   ├────────┼──────┼──────────────┼────────────────────────────────────────────┤
 *   │ POST   │ /ask │ authenticate │ Run RAG pipeline, return generated answer  │
 *   └────────┴──────┴──────────────┴────────────────────────────────────────────┘
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { askQuestion } = require('../controllers/chatController');

const router = express.Router();

// ── POST /ask ─────────────────────────────────────────────────────────────────
//
//   Middleware chain:
//   1. authenticate  — verifies JWT, attaches req.user
//   2. askQuestion   — runs full RAG pipeline, returns answer + sources + chunks
//
router.post('/ask', authenticate, askQuestion);

module.exports = router;

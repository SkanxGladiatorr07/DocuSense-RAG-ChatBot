/**
 * @file routes/conversationRoutes.js
 * @description Conversation management routes.
 *
 *   Base path (mounted in routes/index.js): /api/v1/conversations
 *   Alias (mounted in app.js)            : /api/conversations
 *
 *   ┌────────┬──────────────┬──────────────┬───────────────────────────────────────────┐
 *   │ Method │ Path         │ Middleware   │ Description                               │
 *   ├────────┼──────────────┼──────────────┼───────────────────────────────────────────┤
 *   │ POST   │ /            │ authenticate │ Create a new conversation                 │
 *   │ GET    │ /            │ authenticate │ List user's conversations (paginated)      │
 *   │ GET    │ /:id         │ authenticate │ Fetch conversation + full message history  │
 *   │ PATCH  │ /:id/title   │ authenticate │ Rename a conversation                     │
 *   │ DELETE │ /:id         │ authenticate │ Archive (soft-delete) a conversation      │
 *   └────────┴──────────────┴──────────────┴───────────────────────────────────────────┘
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const {
  createConversation,
  listConversations,
  getConversationWithHistory,
  updateTitle,
  archiveConversation,
  getConversationAnalytics,
} = require('../controllers/conversationController');

const router = express.Router();

// All conversation routes require a valid JWT
router.use(authenticate);

// ── Analytics route ───────────────────────────────────────────────────────────
// Must be defined BEFORE GET /:id so it doesn't get treated as an ID.
router.get('/analytics', getConversationAnalytics);

// ── Collection routes ─────────────────────────────────────────────────────────
router.post('/',   createConversation);   // POST   /
router.get ('/',   listConversations);    // GET    /

// ── Member routes ─────────────────────────────────────────────────────────────
router.get   ('/:id',       getConversationWithHistory); // GET    /:id
router.patch ('/:id/title', updateTitle);                // PATCH  /:id/title
router.delete('/:id',       archiveConversation);        // DELETE /:id

module.exports = router;

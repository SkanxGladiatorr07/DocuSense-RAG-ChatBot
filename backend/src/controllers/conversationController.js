/**
 * @file controllers/conversationController.js
 * @description Request handlers for conversation management endpoints.
 *
 *   Layer responsibilities
 *   ──────────────────────
 *   • Parse and validate request parameters / body.
 *   • Delegate all business logic to conversationService.
 *   • Return a consistent JSON envelope via successResponse.
 *
 *   Routes (mounted at /api/v1/conversations)
 *   ──────────────────────────────────────────
 *   POST /           → createConversation
 *   GET  /           → listConversations
 *   GET  /:id        → getConversationWithHistory
 *   PATCH /:id/title → updateTitle        (bonus — useful for frontend)
 *   DELETE /:id      → archiveConversation (soft-delete)
 */

const asyncHandler           = require('../utils/asyncHandler');
const { successResponse }    = require('../utils/ApiResponse');
const AppError               = require('../utils/AppError');
const mongoose               = require('mongoose');
const { conversationService } = require('../services');

// ── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Validate that :id in req.params is a legal MongoDB ObjectId.
 * Throws AppError 400 so the global error handler formats it consistently.
 */
const requireValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw AppError.badRequest(`"${id}" is not a valid conversation ID.`);
  }
};

// ── POST /api/v1/conversations ────────────────────────────────────────────────

/**
 * Create a new, empty conversation for the authenticated user.
 *
 * Request body (all optional):
 * {
 *   "title": "My HR Policy Questions"
 * }
 *
 * Success response (201):
 * {
 *   "success": true,
 *   "message": "Conversation created successfully.",
 *   "data": {
 *     "conversation": {
 *       "_id"          : "...",
 *       "userId"       : "...",
 *       "title"        : "Conversation — 29 Jun 2026",
 *       "messageCount" : 0,
 *       "lastMessageAt": null,
 *       "isArchived"   : false,
 *       "metadata"     : {},
 *       "createdAt"    : "...",
 *       "updatedAt"    : "..."
 *     }
 *   }
 * }
 *
 * @route  POST /api/v1/conversations
 * @access Private
 */
const createConversation = asyncHandler(async (req, res) => {
  const { title } = req.body;

  // title is optional — service provides a default
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw AppError.badRequest('"title" must be a non-empty string when provided.');
  }

  const conversation = await conversationService.createConversation(
    req.user._id,
    title ?? undefined
  );

  return successResponse(res, 201, 'Conversation created successfully.', {
    conversation,
  });
});

// ── GET /api/v1/conversations ─────────────────────────────────────────────────

/**
 * List all conversations belonging to the authenticated user,
 * sorted by most recent activity (lastMessageAt DESC, createdAt DESC).
 *
 * Query parameters:
 *   ?page=<n>            (default: 1)   — 1-based page number
 *   ?limit=<n>           (default: 20)  — results per page (max: 100)
 *   ?includeArchived=true               — include archived conversations
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Conversations fetched successfully.",
 *   "data": {
 *     "conversations": [ ... ],
 *     "pagination": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
 *   }
 * }
 *
 * @route  GET /api/v1/conversations
 * @access Private
 */
const listConversations = asyncHandler(async (req, res) => {
  const { page, limit, includeArchived } = req.query;

  const result = await conversationService.getUserConversations(req.user._id, {
    page,
    limit,
    includeArchived: includeArchived === 'true',
  });

  return successResponse(res, 200, 'Conversations fetched successfully.', {
    conversations: result.conversations,
    pagination   : result.pagination,
  });
});

// ── GET /api/v1/conversations/:id ─────────────────────────────────────────────

/**
 * Fetch a single conversation together with its complete ordered message history.
 *
 * Query parameters:
 *   ?limit=<n>  (default: 50, max: 200)  — messages per page
 *   ?skip=<n>   (default: 0)             — messages to skip (offset)
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Conversation fetched successfully.",
 *   "data": {
 *     "conversation": {
 *       "_id": "...", "title": "...", "messageCount": 3, ...
 *     },
 *     "messages": [
 *       {
 *         "_id"          : "...",
 *         "sequenceIndex": 0,
 *         "question"     : "What is the leave policy?",
 *         "answer"       : "The leave policy states...",
 *         "sources"      : [ { "documentId": "...", "originalName": "HR.pdf", ... } ],
 *         "retrievalMetadata": { "chunksRetrieved": 5, "topScore": 0.923 },
 *         "llmMetadata"  : { "model": "gemini-2.0-flash", "promptTokens": 312, ... },
 *         "isError"      : false,
 *         "createdAt"    : "..."
 *       }
 *     ],
 *     "pagination": { "total": 3, "limit": 50, "skip": 0 }
 *   }
 * }
 *
 * Error responses:
 *   400 — :id is not a valid ObjectId
 *   404 — conversation not found or not owned by this user
 *
 * @route  GET /api/v1/conversations/:id
 * @access Private
 */
const getConversationWithHistory = asyncHandler(async (req, res) => {
  requireValidId(req.params.id);

  const { limit, skip } = req.query;

  const result = await conversationService.getConversationHistory(
    req.params.id,
    req.user._id,
    { limit, skip }
  );

  return successResponse(res, 200, 'Conversation fetched successfully.', {
    conversation: result.conversation,
    messages    : result.messages,
    pagination  : result.pagination,
  });
});

// ── PATCH /api/v1/conversations/:id/title ─────────────────────────────────────

/**
 * Rename a conversation.
 *
 * Request body:
 * { "title": "New title" }
 *
 * @route  PATCH /api/v1/conversations/:id/title
 * @access Private
 */
const updateTitle = asyncHandler(async (req, res) => {
  requireValidId(req.params.id);

  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw AppError.badRequest('"title" must be a non-empty string.');
  }

  const conversation = await conversationService.updateConversationTitle(
    req.params.id,
    req.user._id,
    title
  );

  return successResponse(res, 200, 'Conversation title updated.', { conversation });
});

// ── DELETE /api/v1/conversations/:id ──────────────────────────────────────────

/**
 * Archive (soft-delete) a conversation.
 * The conversation and its messages are retained in the database.
 *
 * @route  DELETE /api/v1/conversations/:id
 * @access Private
 */
const archiveConversation = asyncHandler(async (req, res) => {
  requireValidId(req.params.id);

  const conversation = await conversationService.archiveConversation(
    req.params.id,
    req.user._id
  );

  return successResponse(res, 200, 'Conversation archived successfully.', { conversation });
});

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  createConversation,
  listConversations,
  getConversationWithHistory,
  updateTitle,
  archiveConversation,
};

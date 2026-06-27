/**
 * @file controllers/searchController.js
 * @description Request handler for semantic search endpoints.
 *
 *   Layer responsibilities
 *   ──────────────────────
 *   • Parse and validate the request body (question field).
 *   • Delegate all business logic to retrievalService.
 *   • Return a consistent JSON envelope via successResponse.
 *
 *   Routes (mounted at /api/v1/search)
 *   ───────────────────────────────────
 *   POST /retrieve  → retrieveChunks
 */

const asyncHandler        = require('../utils/asyncHandler');
const { successResponse } = require('../utils/ApiResponse');
const AppError            = require('../utils/AppError');
const mongoose            = require('mongoose');
const { retrievalService } = require('../services');

// ── POST /api/v1/search/retrieve ──────────────────────────────────────────────

/**
 * Retrieve the most semantically relevant document chunks for a question.
 *
 * Request body:
 * {
 *   "question"   : "What is the leave policy?",   // required
 *   "topK"       : 5,                              // optional (default: 5)
 *   "documentId" : "64f...",                       // optional — restrict to one doc
 *   "minScore"   : 0.0                             // optional — min similarity (0–1)
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Chunks retrieved successfully.",
 *   "data": {
 *     "question": "What is the leave policy?",
 *     "topK": 3,
 *     "results": [
 *       {
 *         "chunkId"   : "64f...",
 *         "chunkIndex": 2,
 *         "content"   : "The leave policy states...",
 *         "score"     : 0.923451,
 *         "wordCount" : 487,
 *         "metadata"  : {},
 *         "document"  : {
 *           "documentId"  : "64f...",
 *           "originalName": "HR_Policy_2024.pdf",
 *           "fileType"    : "application/pdf",
 *           "uploadDate"  : "2026-06-25T...",
 *           "status"      : "indexed"
 *         }
 *       }
 *     ]
 *   }
 * }
 *
 * @route  POST /api/v1/search/retrieve
 * @access Private — requires valid JWT
 */
const retrieveChunks = asyncHandler(async (req, res) => {
  const { question, topK, documentId, minScore } = req.body;

  // ── Validate required field ───────────────────────────────────────────────
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw AppError.badRequest(
      'Request body must include a non-empty "question" string.'
    );
  }

  // ── Optional numeric guards ───────────────────────────────────────────────
  if (topK !== undefined && (typeof topK !== 'number' || topK < 1 || !Number.isInteger(topK))) {
    throw AppError.badRequest('"topK" must be a positive integer.');
  }

  if (minScore !== undefined && (typeof minScore !== 'number' || minScore < 0 || minScore > 1)) {
    throw AppError.badRequest('"minScore" must be a number between 0 and 1.');
  }

  // ── Optional documentId guard ──────────────────────────────────────────────
  if (documentId !== undefined && !mongoose.Types.ObjectId.isValid(documentId)) {
    throw AppError.badRequest('"documentId" must be a valid MongoDB ObjectId.');
  }

  // ── Delegate to retrieval service ─────────────────────────────────────────
  const result = await retrievalService.retrieve(question, {
    topK       : topK       ?? 5,
    documentId : documentId ?? undefined,
    minScore   : minScore   ?? 0,
  });

  return successResponse(res, 200, 'Chunks retrieved successfully.', result);
});

module.exports = { retrieveChunks };

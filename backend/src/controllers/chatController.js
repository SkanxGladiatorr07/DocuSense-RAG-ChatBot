/**
 * @file controllers/chatController.js
 * @description Request handler for the RAG chat endpoint.
 *
 *   Layer responsibilities
 *   ──────────────────────
 *   • Parse and validate the request body (question field + optional tuning params).
 *   • Delegate the complete RAG pipeline to ragService.ask().
 *   • Shape and return a consistent JSON envelope.
 *
 *   Routes (mounted at /api/v1/chat)
 *   ──────────────────────────────────
 *   POST /ask  → askQuestion
 */

const asyncHandler         = require('../utils/asyncHandler');
const { successResponse }  = require('../utils/ApiResponse');
const AppError             = require('../utils/AppError');
const mongoose             = require('mongoose');
const { ragService, promptBuilderService } = require('../services');

// ── POST /api/v1/chat/ask ─────────────────────────────────────────────────────

/**
 * Run the full RAG pipeline and return a generated answer.
 *
 * Request body:
 * {
 *   "question"        : "What is the leave policy?",  // required
 *   "topK"            : 5,                            // optional (default: 5)
 *   "documentId"      : "64f...",                     // optional — restrict to one doc
 *   "minScore"        : 0.0,                          // optional — similarity floor (0–1)
 *   "template"        : "standard",                   // optional — prompt template
 *   "maxOutputTokens" : 1024,                         // optional — LLM token ceiling
 *   "temperature"     : 0.2                           // optional — LLM temperature (0–1)
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Answer generated successfully.",
 *   "data": {
 *     "answer"       : "The leave policy allows...",
 *     "question"     : "What is the leave policy?",
 *     "model"        : "gemini-2.0-flash",
 *     "finishReason" : "STOP",
 *     "confidence": {
 *       "averageScore"    : 0.856123,
 *       "topScore"        : 0.923451,
 *       "lowestScore"     : 0.743210,
 *       "retrievedChunks" : 5
 *     },
 *     "usage": {
 *       "promptTokens" : 312,
 *       "outputTokens" : 148
 *     },
 *     "citations": [
 *       { "citationNumber": 1, "documentName": "HR_Policy.pdf", "pageNumber": 4, "score": 0.923 }
 *     ],
 *     "references": [
 *       { "referenceNumber": 1, "documentName": "HR_Policy.pdf", "pageNumbers": [4, 7] }
 *     ],
 *     "sources": [
 *       { "documentId": "64f...", "originalName": "HR_Policy_2024.pdf", "status": "indexed" }
 *     ],
 *     "chunks": [
 *       { "chunkId": "64f...", "chunkIndex": 2, "content": "...", "score": 0.923451 }
 *     ]
 *   }
 * }
 *
 * Error responses:
 *   400 — missing/invalid question, bad topK/minScore/documentId, unknown template
 *   404 — no indexed chunks available to search
 *   502 — Gemini API failure (embedding or generation)
 *
 * @route  POST /api/v1/chat/ask
 * @access Private — requires valid JWT
 */
const askQuestion = asyncHandler(async (req, res) => {
  const {
    question,
    topK,
    documentId,
    minScore,
    template,
    maxOutputTokens,
    temperature,
  } = req.body;

  // ── Validate required field ────────────────────────────────────────────────
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw AppError.badRequest(
      'Request body must include a non-empty "question" string.'
    );
  }

  // ── Optional numeric guards ────────────────────────────────────────────────
  if (topK !== undefined && (typeof topK !== 'number' || topK < 1 || !Number.isInteger(topK))) {
    throw AppError.badRequest('"topK" must be a positive integer.');
  }

  if (minScore !== undefined && (typeof minScore !== 'number' || minScore < 0 || minScore > 1)) {
    throw AppError.badRequest('"minScore" must be a number between 0 and 1.');
  }

  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 1)) {
    throw AppError.badRequest('"temperature" must be a number between 0 and 1.');
  }

  if (maxOutputTokens !== undefined && (typeof maxOutputTokens !== 'number' || maxOutputTokens < 1 || !Number.isInteger(maxOutputTokens))) {
    throw AppError.badRequest('"maxOutputTokens" must be a positive integer.');
  }

  // ── Optional documentId guard ──────────────────────────────────────────────
  if (documentId !== undefined && !mongoose.Types.ObjectId.isValid(documentId)) {
    throw AppError.badRequest('"documentId" must be a valid MongoDB ObjectId.');
  }

  // ── Optional template guard ────────────────────────────────────────────────
  if (template !== undefined) {
    const validTemplates = promptBuilderService.listTemplates();
    if (!validTemplates.includes(template)) {
      throw AppError.badRequest(
        `"template" must be one of: ${validTemplates.join(', ')}.`
      );
    }
  }

  // ── Delegate to RAG pipeline ───────────────────────────────────────────────
  const result = await ragService.ask(question, {
    topK,
    documentId,
    minScore,
    template,
    maxOutputTokens,
    temperature,
  });

  // ── Shape response ─────────────────────────────────────────────────────────
  return successResponse(res, 200, 'Answer generated successfully.', {
    answer      : result.answer,
    question    : result.question,
    model       : result.model,
    finishReason: result.finishReason,
    confidence  : result.confidence,
    usage: {
      promptTokens: result.promptTokens,
      outputTokens: result.outputTokens,
    },
    sources    : result.sources,
    citations  : result.citations,
    references : result.references,
    chunks     : result.chunks,
  });
});

module.exports = { askQuestion };

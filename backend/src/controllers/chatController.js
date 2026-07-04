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
const env                  = require('../config/env');
const logger               = require('../utils/logger');
const { ragService, promptBuilderService, cacheService, conversationService } = require('../services');

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
    conversationId,
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

  // ── Optional conversationId guard ──────────────────────────────────────────
  if (conversationId !== undefined && !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw AppError.badRequest('"conversationId" must be a valid MongoDB ObjectId.');
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

  // ── Retrieve bypass flag ───────────────────────────────────────────────────
  const bypassCache = req.headers['x-bypass-cache'] === 'true' ||
                      req.headers['cache-control'] === 'no-cache' ||
                      req.body.bypassCache === true ||
                      req.body.noCache === true;

  // ── Construct Deterministic Cache Key ───────────────────────────────────────
  const normalizedQuestion = question.trim().toLowerCase();
  const cacheKey = `chat:${req.user._id}:${normalizedQuestion}:` +
    `k=${topK || 'default'}:` +
    `d=${documentId || 'all'}:` +
    `s=${minScore || 'none'}:` +
    `t=${template || 'standard'}:` +
    `o=${maxOutputTokens || 'default'}:` +
    `temp=${temperature || 'default'}`;

  let result;
  let cachedData = null;

  if (!bypassCache) {
    try {
      cachedData = await cacheService.get(cacheKey);
    } catch (cacheErr) {
      logger.error(`[chatController] Cache read failed: ${cacheErr.message}`);
    }
  }

  if (cachedData) {
    res.setHeader('X-Cache', 'HIT');
    logger.info(`[chatController] Serving cached response for key: ${cacheKey}`);
    result = cachedData;
  } else {
    res.setHeader('X-Cache', 'MISS');
    logger.info(`[chatController] Cache miss. Delegating query to RAG pipeline.`);

    // ── Delegate to RAG pipeline ───────────────────────────────────────────────
    result = await ragService.ask(question, {
      topK,
      documentId,
      minScore,
      template,
      maxOutputTokens,
      temperature,
    });

    // ── Save to Cache ─────────────────────────────────────────────────────────
    try {
      await cacheService.set(cacheKey, result, env.chatCacheTtlSec);
    } catch (cacheErr) {
      logger.error(`[chatController] Cache write failed: ${cacheErr.message}`);
    }
  }

  // ── Save to Conversation History (if conversationId provided) ─────────────
  if (conversationId) {
    try {
      await conversationService.addMessage(conversationId, req.user._id, {
        question: question.trim(),
        answer: result.answer,
        sources: result.sources || [],
        retrievalMetadata: {
          chunksRetrieved: result.confidence?.retrievedChunks || 0,
          topScore: result.confidence?.topScore || 0,
        },
        llmMetadata: {
          model: result.model,
          promptTokens: result.promptTokens || 0,
          outputTokens: result.outputTokens || 0,
        }
      });
    } catch (msgErr) {
      logger.error(`[chatController] Failed to save message to history: ${msgErr.message}`);
    }
  }

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
    conversationId,
  });
});

module.exports = { askQuestion };

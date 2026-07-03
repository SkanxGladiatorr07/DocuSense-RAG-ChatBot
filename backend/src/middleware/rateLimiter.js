/**
 * @file middleware/rateLimiter.js
 * @description Centralized rate-limiting middleware using express-rate-limit.
 *
 *   Registers separate limiters for authentication, chat, and document uploads
 *   to prevent bruteforce attacks, resource abuse, and API rate-limit exhaustion.
 *
 *   Configured values are loaded from config/env.js (with defaults).
 *   Exceeded limits trigger a 429 AppError, which propagates down to the
 *   centralized errorHandler for a uniform API response.
 */

const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Custom handler that translates the limit-reached trigger into an AppError.
 * This guarantees the response adheres to the global JSON shape.
 */
const limitReachedHandler = (req, res, next, options) => {
  next(AppError.tooManyRequests(options.message));
};

// ── 1. Authentication Rate Limiter ──────────────────────────────────────────
// Protects endpoints like POST /api/auth/register and POST /api/auth/login.
const authLimiter = rateLimit({
  windowMs: env.rateLimitAuthWindowMs,
  max: env.rateLimitAuthMax,
  message: 'Too many authentication attempts. Please try again later.',
  handler: limitReachedHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 2. Chat/RAG Querying Rate Limiter ─────────────────────────────────────────
// Protects endpoints like POST /api/chat/ask.
const chatLimiter = rateLimit({
  windowMs: env.rateLimitChatWindowMs,
  max: env.rateLimitChatMax,
  message: 'Too many chat messages. Please wait a moment before sending more.',
  handler: limitReachedHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 3. Document Ingestion Rate Limiter ────────────────────────────────────────
// Protects endpoints like POST /api/documents/upload.
const uploadLimiter = rateLimit({
  windowMs: env.rateLimitUploadWindowMs,
  max: env.rateLimitUploadMax,
  message: 'Too many file uploads. Please try again later.',
  handler: limitReachedHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  chatLimiter,
  uploadLimiter,
};

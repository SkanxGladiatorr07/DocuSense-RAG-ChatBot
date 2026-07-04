/**
 * @file config/env.js
 * @description Centralised environment configuration.
 *
 *   Load order:
 *   1. dotenv populates process.env from .env
 *   2. validateEnv() checks all required vars — exits immediately on failure
 *   3. The `env` object is built from validated process.env values and exported
 *
 *   Every other module imports from here instead of reading process.env directly,
 *   so config is typed, defaulted, and validated in a single place.
 */

const dotenv   = require('dotenv');
const validateEnv = require('./validateEnv');

// ── 1. Load .env ──────────────────────────────────────────────────────────────
dotenv.config();

// ── 2. Validate — exits the process if any rule fails ────────────────────────
validateEnv();

// ── 3. Build and export typed config object ───────────────────────────────────
const env = {
  // Server
  nodeEnv : process.env.NODE_ENV  || 'development',
  port    : parseInt(process.env.PORT, 10),

  // Database
  mongoUri: process.env.MONGO_URI,

  // CORS — supports comma-separated list for multi-origin setups
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'],

  // Auth
  jwtSecret   : process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Groq
  groqApiKey: process.env.GROQ_API_KEY,

  // Rate Limiting Config
  rateLimitAuthWindowMs  : parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10)   || 15 * 60 * 1000,
  rateLimitAuthMax        : parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10)         || 20,
  rateLimitChatWindowMs  : parseInt(process.env.RATE_LIMIT_CHAT_WINDOW_MS, 10)   || 1 * 60 * 1000,
  rateLimitChatMax        : parseInt(process.env.RATE_LIMIT_CHAT_MAX, 10)         || 30,
  rateLimitUploadWindowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitUploadMax      : parseInt(process.env.RATE_LIMIT_UPLOAD_MAX, 10)       || 10,

  // Caching Config
  chatCacheTtlSec: parseInt(process.env.CHAT_CACHE_TTL_SEC, 10) || 300,

  // Convenience flags
  isDev : (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = env;

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

  // Convenience flags
  isDev : (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = env;

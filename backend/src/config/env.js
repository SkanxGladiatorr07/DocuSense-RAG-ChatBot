/**
 * @file config/env.js
 * @description Centralised environment configuration.
 *              Validates that required variables are present at startup
 *              so the app fails fast with a clear error rather than
 *              silently misbehaving at runtime.
 */

const dotenv = require('dotenv');

// Load .env file before anything else reads process.env
dotenv.config();

const _required = [
  'JWT_SECRET',
];

const _missing = _required.filter((key) => !process.env[key]);

if (_missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${_missing.join(', ')}\n` +
      `Check .env.example for reference.`
  );
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/docusense',
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'],
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = env;

/**
 * @file config/db.js
 * @description MongoDB connection management using Mongoose.
 *
 *  - connectDB()    → call once at startup; resolves when ready, rejects on error.
 *  - disconnectDB() → call during graceful shutdown.
 *
 *  Runtime events (disconnected / reconnected / error) are monitored so issues
 *  surface in logs even after the initial handshake succeeds.
 */

'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

// ── Runtime connection-event listeners ────────────────────────────────────────
// Attach once so they survive reconnections.

mongoose.connection.on('connected', () => {
  logger.info('Mongoose: connection established.');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose: connection lost. Waiting for reconnect…');
});

mongoose.connection.on('reconnected', () => {
  logger.info('Mongoose: reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Mongoose runtime error: ${err.message}`);
});

// ── connectDB ─────────────────────────────────────────────────────────────────

/**
 * Open a Mongoose connection to MongoDB.
 * Throws (and exits with code 1) on failure so server.js never binds
 * the HTTP port before the database is ready.
 */
const connectDB = async () => {
  // Fail fast if the URI was not supplied
  if (!env.mongoUri) {
    logger.error('MONGO_URI is not defined. Add it to your .env file.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(env.mongoUri, {
      // autoIndex speeds up dev queries; disable in prod for write performance
      autoIndex: env.isDev,
    });

    const { host, port, name } = conn.connection;
    logger.info('─────────────────────────────────────────');
    logger.info('  MongoDB Connected');
    logger.info(`  Host     : ${host}:${port}`);
    logger.info(`  Database : ${name}`);
    logger.info(`  Mode     : ${env.nodeEnv}`);
    logger.info('─────────────────────────────────────────');
  } catch (error) {
    logger.error('─────────────────────────────────────────');
    logger.error('  MongoDB Connection FAILED');
    logger.error(`  Reason : ${error.message}`);
    logger.error('  Check MONGO_URI in your .env file.');
    logger.error('─────────────────────────────────────────');
    process.exit(1); // Non-zero exit triggers a restart in PM2 / Docker
  }
};

// ── disconnectDB ──────────────────────────────────────────────────────────────

/**
 * Close the Mongoose connection cleanly.
 * Called from the graceful-shutdown handler in server.js.
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully.');
  } catch (error) {
    logger.error(`Error while closing MongoDB connection: ${error.message}`);
  }
};

module.exports = { connectDB, disconnectDB };

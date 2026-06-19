/**
 * @file config/db.js
 * @description MongoDB connection using Mongoose.
 *              Called once from server.js before the HTTP server starts.
 */

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      // Mongoose 6+ has these on by default, but explicit is safer
      autoIndex: env.isDev, // Disable in prod for performance
    });

    logger.info(`MongoDB connected → ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1); // Non-zero exit triggers restart in PM2 / Docker
  }
};

// Graceful disconnect helper (used in server shutdown)
const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed.');
};

module.exports = { connectDB, disconnectDB };

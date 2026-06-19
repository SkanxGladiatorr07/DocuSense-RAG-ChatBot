/**
 * @file server.js
 * @description HTTP server entry point.
 *              Connects to the database, binds the Express app to a port,
 *              and wires graceful shutdown handlers for SIGTERM / SIGINT.
 */

// Config is loaded first so all subsequent modules can read process.env
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Bind HTTP server
    const server = app.listen(env.port, () => {
      logger.info('─────────────────────────────────────────');
      logger.info('  DocuSense RAG API');
      logger.info(`  Environment : ${env.nodeEnv}`);
      logger.info(`  Port        : ${env.port}`);
      logger.info(`  Base URL    : http://localhost:${env.port}`);
      logger.info(`  API v1      : http://localhost:${env.port}/api/v1`);
      logger.info('─────────────────────────────────────────');
    });

    // ── Graceful Shutdown ─────────────────────────────────────────────────────
    const shutdown = async (signal) => {
      logger.warn(`\n${signal} received — shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed.');
        await disconnectDB();
        logger.info('Goodbye 👋');
        process.exit(0);
      });

      // Force-exit if connections hang longer than 10 s
      setTimeout(() => {
        logger.error('Forcefully shutting down after timeout.');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled promise rejections (safety net)
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      shutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();

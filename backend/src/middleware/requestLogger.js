/**
 * @file middleware/requestLogger.js
 * @description Custom Express middleware for request logging and performance measurement.
 *
 *   Uses high-resolution process.hrtime() to measure the exact execution duration
 *   of each request. Once the response completes ('finish' event), it logs
 *   the HTTP method, request path, status code, and latency in milliseconds.
 *
 *   Logs are routed through the application's central logger (utils/logger.js)
 *   so they benefit from structured timestamps, logging level overrides, and
 *   appropriate log-level routing (info/warn/error).
 */

const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = process.hrtime();
  const { method, originalUrl } = req;

  // Listen for the response finish event
  res.on('finish', () => {
    const diff = process.hrtime(start);
    // Convert hrtime duration to milliseconds with 2 decimal precision
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const status = res.statusCode;

    // Align log level to status class
    let logLevel = 'info';
    if (status >= 500) {
      logLevel = 'error';
    } else if (status >= 400) {
      logLevel = 'warn';
    }

    logger[logLevel](`[request] ${method} ${originalUrl} ${status} - ${durationMs}ms`);
  });

  next();
};

module.exports = requestLogger;

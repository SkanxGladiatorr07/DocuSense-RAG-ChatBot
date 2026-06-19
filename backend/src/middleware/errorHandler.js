/**
 * @file middleware/errorHandler.js
 * @description Global error-handling middleware.
 *              Must be registered LAST in app.js (after all routes).
 *              Catches both ApiError instances and unexpected errors.
 */

const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Log the full error in development; just the message in production
  if (process.env.NODE_ENV !== 'production') {
    logger.error(err.stack || err.message);
  } else {
    logger.error(`${err.name}: ${err.message}`);
  }

  // Known operational error thrown by our code
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors.length > 0 && { errors: err.errors }),
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for '${field}'. Please use a different value.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  // Fallback — unexpected / unhandled error
  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
};

module.exports = errorHandler;

/**
 * @file middleware/errorHandler.js
 * @description Centralized global error-handling middleware.
 *
 *   Must be registered LAST in app.js (after all routes and the 404 handler).
 *   Express identifies this as an error handler because it accepts 4 arguments.
 *
 *   Handles the following error categories:
 *   ┌─────────────────────────┬──────┬────────────────────────────────────────┐
 *   │ Error Type              │ Code │ Source                                 │
 *   ├─────────────────────────┼──────┼────────────────────────────────────────┤
 *   │ AppError / ApiError     │ var. │ Our own code (operational errors)      │
 *   │ Mongoose ValidationError│ 400  │ Schema validation failures             │
 *   │ Mongoose CastError      │ 400  │ Invalid ObjectId / type cast           │
 *   │ Mongoose Duplicate Key  │ 409  │ Unique index violation (code 11000)    │
 *   │ JWT JsonWebTokenError   │ 401  │ Malformed / invalid token              │
 *   │ JWT TokenExpiredError   │ 401  │ Token past its expiry date             │
 *   │ JWT NotBeforeError      │ 401  │ Token used before nbf claim            │
 *   │ Payload Too Large       │ 413  │ express.json() body size exceeded      │
 *   │ SyntaxError (JSON)      │ 400  │ Malformed JSON body                    │
 *   │ Internal Server Error   │ 500  │ Unexpected / programming errors        │
 *   └─────────────────────────┴──────┴────────────────────────────────────────┘
 *
 *   All responses share the same envelope shape (see utils/ApiResponse.js).
 */

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ApiError = require('../utils/ApiError'); // legacy alias — kept for back-compat

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract a human-readable list of field-level Mongoose validation messages.
 * @param {import('mongoose').Error.ValidationError} err
 * @returns {string[]}
 */
const extractMongooseValidationErrors = (err) =>
  Object.values(err.errors).map((e) => e.message);

/**
 * Build the consistent error response envelope.
 * @param {import('express').Response} res
 * @param {import('express').Request}  req
 * @param {number}   statusCode
 * @param {string}   message
 * @param {string[]} [errors=[]]
 */
const sendError = (res, req, statusCode, message, errors = []) => {
  const payload = {
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  // Never expose stack traces to clients
  return res.status(statusCode).json(payload);
};

// ── Logger helper ─────────────────────────────────────────────────────────────

const logError = (err) => {
  if (process.env.NODE_ENV !== 'production') {
    // Full stack in development
    logger.error(err.stack || err.message);
  } else {
    // Minimal footprint in production
    logger.error(`[${err.name}] ${err.statusCode || 500} — ${err.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global error-handling middleware.
 * The unused `next` parameter MUST be present so Express treats this as an
 * error handler (4-argument signature).
 *
 * @param {Error}                      err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logError(err);

  // ── 1. Our own operational errors (AppError or legacy ApiError) ─────────────
  if (err instanceof AppError || err instanceof ApiError) {
    return sendError(
      res,
      req,
      err.statusCode,
      err.message,
      err.errors || []
    );
  }

  // ── 2. JWT Errors ───────────────────────────────────────────────────────────
  // jsonwebtoken throws named error classes; handle all three variants.

  if (err.name === 'TokenExpiredError') {
    return sendError(res, req, 401, 'Session expired. Please log in again.');
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, req, 401, 'Invalid token. Please log in again.');
  }

  if (err.name === 'NotBeforeError') {
    return sendError(res, req, 401, 'Token not yet active. Please log in again.');
  }

  // ── 3. Mongoose Validation Error ─────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = extractMongooseValidationErrors(err);
    return sendError(res, req, 400, 'Validation failed.', errors);
  }

  // ── 4. Mongoose CastError (e.g. invalid ObjectId) ────────────────────────────
  if (err.name === 'CastError') {
    return sendError(
      res,
      req,
      400,
      `Invalid value '${err.value}' for field '${err.path}'.`
    );
  }

  // ── 5. Mongoose Duplicate Key Error ──────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || '';
    return sendError(
      res,
      req,
      409,
      `'${value}' is already registered for '${field}'. Please use a different value.`
    );
  }

  // ── 6. Request Payload Too Large ─────────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    return sendError(res, req, 413, 'Request payload is too large.');
  }

  // ── 7. Malformed JSON Body ────────────────────────────────────────────────────
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, req, 400, 'Malformed JSON in request body.');
  }

  // ── 8. Fallback — unexpected / unhandled error ────────────────────────────────
  // Do not leak internal details to the client in production.
  const message =
    process.env.NODE_ENV !== 'production'
      ? err.message || 'Internal Server Error'
      : 'Internal Server Error';

  return sendError(res, req, 500, message);
};

module.exports = errorHandler;

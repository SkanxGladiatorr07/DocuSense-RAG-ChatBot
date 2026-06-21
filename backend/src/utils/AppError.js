/**
 * @file utils/AppError.js
 * @description Centralized application error class.
 *
 *   Extends the native Error with an HTTP `statusCode`, an `isOperational`
 *   flag (distinguishes expected/operational errors from programming bugs),
 *   and optional validation `errors` array.
 *
 *   Static factory methods cover every common HTTP error scenario so
 *   controllers can throw descriptive errors without importing status codes.
 *
 * Usage:
 *   throw AppError.notFound('User not found');
 *   throw AppError.badRequest('Email is required', [{ field: 'email' }]);
 *   throw new AppError(422, 'Custom message');
 */

class AppError extends Error {
  /**
   * @param {number} statusCode   HTTP status code (4xx / 5xx)
   * @param {string} message      Human-readable error message
   * @param {Array}  [errors=[]]  Optional array of validation / field errors
   * @param {boolean} [isOperational=true]
   *   true  → expected, handled error (validation, auth, not-found, …)
   *   false → unexpected programming bug; should trigger process restart
   */
  constructor(statusCode, message, errors = [], isOperational = true) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    // Maintain proper V8 stack trace (omits AppError constructor frame)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  // ── 4xx Client Errors ───────────────────────────────────────────────────────

  /** 400 Bad Request */
  static badRequest(message = 'Bad Request', errors = []) {
    return new AppError(400, message, errors);
  }

  /** 401 Unauthorized */
  static unauthorized(message = 'Unauthorized. Please log in.') {
    return new AppError(401, message);
  }

  /** 403 Forbidden */
  static forbidden(message = 'Forbidden. You do not have permission.') {
    return new AppError(403, message);
  }

  /** 404 Not Found */
  static notFound(message = 'Resource not found.') {
    return new AppError(404, message);
  }

  /** 409 Conflict */
  static conflict(message = 'Conflict. Resource already exists.') {
    return new AppError(409, message);
  }

  /** 422 Unprocessable Entity */
  static unprocessable(message = 'Unprocessable entity.', errors = []) {
    return new AppError(422, message, errors);
  }

  /** 429 Too Many Requests */
  static tooManyRequests(message = 'Too many requests. Please slow down.') {
    return new AppError(429, message);
  }

  // ── 5xx Server Errors ───────────────────────────────────────────────────────

  /**
   * 500 Internal Server Error
   * Marked as non-operational (isOperational = false) because the caller
   * should use AppError.badRequest / notFound / etc. for expected errors.
   */
  static internal(message = 'Internal Server Error') {
    return new AppError(500, message, [], false);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Returns true if the error should be exposed to the client */
  get isClientError() {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  toJSON() {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      errors: this.errors,
      isOperational: this.isOperational,
    };
  }
}

module.exports = AppError;

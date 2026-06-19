/**
 * @file utils/ApiError.js
 * @description Custom error class that carries an HTTP status code.
 *              Thrown from services/controllers and caught by the global
 *              error-handling middleware in middleware/errorHandler.js
 */

class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code (e.g. 400, 404, 500)
   * @param {string} message     Human-readable error message
   * @param {Array}  [errors]    Optional validation error details
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

module.exports = ApiError;

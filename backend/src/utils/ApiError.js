/**
 * @file utils/ApiError.js
 * @description Backward-compatible alias for AppError.
 *
 *   Kept so existing code that imports ApiError continues to work without
 *   changes. New code should import AppError directly.
 *
 *   All AppError static factories (badRequest, unauthorized, notFound, etc.)
 *   are available via AppError.  ApiError usage: `new ApiError(statusCode, message, errors)`.
 */

const AppError = require('./AppError');

/**
 * @deprecated Use AppError instead.
 *   `new ApiError(statusCode, msg, errors)` still works because ApiError
 *   extends AppError and the constructor signature is identical.
 */
class ApiError extends AppError {
  constructor(statusCode, message, errors = []) {
    super(statusCode, message, errors, true);
    this.name = 'ApiError';
  }
}

module.exports = ApiError;

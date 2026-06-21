/**
 * @file utils/ApiResponse.js
 * @description Reusable API response utilities.
 *
 *   Provides two named functions that standardise every JSON response
 *   sent from the Express API:
 *
 *   Success envelope:
 *   {
 *     success : true,
 *     message : string,
 *     data    : object | null
 *   }
 *
 *   Error envelope:
 *   {
 *     success : false,
 *     message : string,
 *     error   : object | null
 *   }
 *
 * Usage (in a controller):
 *   const { successResponse, errorResponse } = require('../utils/ApiResponse');
 *
 *   // success
 *   return successResponse(res, 201, 'User created', { user });
 *
 *   // error
 *   return errorResponse(res, 404, 'User not found');
 *   return errorResponse(res, 400, 'Validation failed', { field: 'email', issue: 'required' });
 */

// ── Core utilities ─────────────────────────────────────────────────────────────

/**
 * Send a standardised success response.
 *
 * @param {import('express').Response} res        - Express response object
 * @param {number}  [statusCode=200]              - HTTP status code (2xx)
 * @param {string}  [message='Success']           - Human-readable message
 * @param {object|null} [data=null]               - Response payload
 * @returns {import('express').Response}
 *
 * @example
 * successResponse(res, 200, 'Profile fetched', { user });
 * // → { success: true, message: 'Profile fetched', data: { user: { ... } } }
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null) => {
  const payload = {
    success: true,
    message,
    data: data !== null ? data : {},
  };
  return res.status(statusCode).json(payload);
};

/**
 * Send a standardised error response.
 *
 * @param {import('express').Response} res        - Express response object
 * @param {number}  [statusCode=500]              - HTTP status code (4xx / 5xx)
 * @param {string}  [message='Internal Server Error'] - Human-readable message
 * @param {object|null} [error=null]              - Error detail object (field errors, metadata, etc.)
 * @returns {import('express').Response}
 *
 * @example
 * errorResponse(res, 404, 'User not found');
 * // → { success: false, message: 'User not found', error: {} }
 *
 * errorResponse(res, 400, 'Validation failed', { field: 'email', issue: 'required' });
 * // → { success: false, message: 'Validation failed', error: { field: 'email', issue: 'required' } }
 */
const errorResponse = (res, statusCode = 500, message = 'Internal Server Error', error = null) => {
  const payload = {
    success: false,
    message,
    error: error !== null && typeof error === 'object' ? error : {},
  };
  return res.status(statusCode).json(payload);
};

// ── ApiResponse class (convenience wrapper — keeps existing code unbroken) ─────
//
//   Code written before this refactor uses:
//     ApiResponse.success(res, statusCode, message, data)
//     ApiResponse.error(res, req, statusCode, message, errors)
//   Both still work via the class below.

class ApiResponse {
  /**
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} [data=null]
   */
  static success(res, statusCode = 200, message = 'Success', data = null) {
    return successResponse(res, statusCode, message, data);
  }

  /**
   * @param {import('express').Response} res
   * @param {import('express').Request|null} req  (kept for signature compat, not used)
   * @param {number} statusCode
   * @param {string} message
   * @param {object|null} [error=null]
   */
  static error(res, req = null, statusCode = 500, message = 'Internal Server Error', error = null) {
    return errorResponse(res, statusCode, message, error);
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = ApiResponse;                   // default: class (back-compat)
module.exports.successResponse = successResponse; // named export
module.exports.errorResponse   = errorResponse;   // named export

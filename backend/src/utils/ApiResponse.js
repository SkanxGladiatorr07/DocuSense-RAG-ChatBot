/**
 * @file utils/ApiResponse.js
 * @description Standardised API response wrapper.
 *
 *   Every response — success or error — shares the same envelope shape:
 *   {
 *     success   : boolean,
 *     message   : string,
 *     data      : object | null,   // present on success
 *     errors    : array  | null,   // present on error
 *     timestamp : ISO string,
 *     path      : string           // request URL (when req is provided)
 *   }
 *
 * Usage (in a controller):
 *   ApiResponse.success(res, 200, 'User created', { user });
 *   ApiResponse.error(res, req, 400, 'Validation failed', [{ field: 'email' }]);
 */

class ApiResponse {
  /**
   * Send a successful JSON response.
   *
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} [data=null]
   * @param {import('express').Request} [req]  - optional, adds `path` field
   */
  static success(res, statusCode = 200, message = 'Success', data = null, req = null) {
    const payload = {
      success: true,
      message,
      ...(data !== null && { data }),
      timestamp: new Date().toISOString(),
      ...(req && { path: req.originalUrl }),
    };
    return res.status(statusCode).json(payload);
  }

  /**
   * Send an error JSON response.
   *
   * @param {import('express').Response} res
   * @param {import('express').Request|null} req
   * @param {number} statusCode
   * @param {string} message
   * @param {Array|null} [errors=null]
   */
  static error(res, req = null, statusCode = 500, message = 'Internal Server Error', errors = null) {
    const payload = {
      success: false,
      message,
      ...(errors !== null && Array.isArray(errors) && errors.length > 0 && { errors }),
      timestamp: new Date().toISOString(),
      ...(req && { path: req.originalUrl }),
    };
    return res.status(statusCode).json(payload);
  }
}

module.exports = ApiResponse;

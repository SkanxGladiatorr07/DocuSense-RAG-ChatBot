/**
 * @file utils/ApiResponse.js
 * @description Standardised API response wrapper.
 *              Keeps controller responses consistent across all endpoints.
 */

class ApiResponse {
  /**
   * Send a successful JSON response.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} [data]
   */
  static success(res, statusCode = 200, message = 'Success', data = null) {
    const payload = { success: true, message };
    if (data !== null) payload.data = data;
    return res.status(statusCode).json(payload);
  }

  /**
   * Send an error JSON response.
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {*} [errors]
   */
  static error(res, statusCode = 500, message = 'Internal Server Error', errors = null) {
    const payload = { success: false, message };
    if (errors !== null) payload.errors = errors;
    return res.status(statusCode).json(payload);
  }
}

module.exports = ApiResponse;

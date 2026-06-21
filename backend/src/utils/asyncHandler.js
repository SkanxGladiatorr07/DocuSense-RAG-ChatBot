/**
 * @file utils/asyncHandler.js
 * @description Wraps an async Express route handler to automatically forward
 *              any rejected promise (or thrown error) to next(), eliminating
 *              repetitive try/catch blocks in every controller.
 *
 * Usage (in a controller):
 *   const asyncHandler = require('../utils/asyncHandler');
 *
 *   exports.getUser = asyncHandler(async (req, res) => {
 *     const user = await User.findById(req.params.id);
 *     if (!user) throw AppError.notFound('User not found');
 *     ApiResponse.success(res, 200, 'User fetched', { user });
 *   });
 */

/**
 * @param {Function} fn  Async route handler (req, res, next) => Promise
 * @returns {Function}   Standard Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

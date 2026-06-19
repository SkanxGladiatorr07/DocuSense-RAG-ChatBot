/**
 * @file middleware/notFound.js
 * @description Catches any request that didn't match a registered route
 *              and forwards a 404 ApiError to the global error handler.
 */

const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = notFound;

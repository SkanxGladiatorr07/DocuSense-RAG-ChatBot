/**
 * @file middleware/authorise.js
 * @description Role-based access control (RBAC) middleware.
 *
 *   Must be used AFTER the `authenticate` middleware, because it relies on
 *   req.user being populated.
 *
 * Usage (in a route file):
 *   const authenticate = require('../middleware/authenticate');
 *   const authorise    = require('../middleware/authorise');
 *
 *   // Only admins can access this route
 *   router.delete('/users/:id', authenticate, authorise('admin'), controller.deleteUser);
 *
 *   // Both admins and employees can access this route
 *   router.get('/documents', authenticate, authorise('admin', 'employee'), controller.listDocs);
 */

const ApiError = require('../utils/ApiError');

/**
 * Returns an Express middleware that allows access only to users whose role
 * is included in the provided list of allowed roles.
 *
 * @param {...string} roles - One or more allowed roles (e.g. 'admin', 'employee')
 * @returns {import('express').RequestHandler}
 */
const authorise = (...roles) => {
  return (req, res, next) => {
    // authenticate middleware must run first
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated. Please log in.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}.`
        )
      );
    }

    next();
  };
};

module.exports = authorise;

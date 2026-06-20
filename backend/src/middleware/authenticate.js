/**
 * @file middleware/authenticate.js
 * @description JWT authentication middleware.
 *
 *   Reads the Authorization header (Bearer <token>), verifies the token,
 *   fetches the matching user from the database, and attaches the user
 *   document to req.user so downstream controllers can access it.
 *
 * Usage (in a route file):
 *   const authenticate = require('../middleware/authenticate');
 *   router.get('/protected', authenticate, controller.handler);
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove "Bearer " prefix
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────

const authenticate = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const token = extractToken(req);
    if (!token) {
      throw new ApiError(401, 'Access denied. No token provided.');
    }

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      // Distinguish between expired and invalid tokens for clearer feedback
      if (err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Session expired. Please log in again.');
      }
      throw new ApiError(401, 'Invalid token. Please log in again.');
    }

    // 3. Fetch the user from the database
    //    This ensures the token is for a user that still exists (e.g. not deleted)
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new ApiError(401, 'User associated with this token no longer exists.');
    }

    // 4. Attach the user to the request for downstream middleware / controllers
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;

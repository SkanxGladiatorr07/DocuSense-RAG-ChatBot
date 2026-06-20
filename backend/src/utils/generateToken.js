/**
 * @file utils/generateToken.js
 * @description Generates a signed JWT for authenticated users.
 *              Kept separate from the User model to maintain clean separation
 *              of concerns — models handle data, utilities handle business logic.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Signs and returns a JWT token.
 * @param {string} id   - The user's MongoDB _id
 * @param {string} role - The user's role ('admin' | 'employee')
 * @returns {string} Signed JWT string
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

module.exports = generateToken;

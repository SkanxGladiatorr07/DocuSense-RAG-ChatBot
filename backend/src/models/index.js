/**
 * @file models/index.js
 * @description Barrel file for Mongoose models.
 *              Export all models from here for centralised access.
 *
 * Example:
 *   module.exports.User     = require('./User');
 *   module.exports.Document = require('./Document');
 *   module.exports.Chat     = require('./Chat');
 */

module.exports = {
  User        : require('./User'),
  Document    : require('./Document'),
  Chunk       : require('./Chunk'),
  Conversation: require('./Conversation'),
  Message     : require('./Message'),
};


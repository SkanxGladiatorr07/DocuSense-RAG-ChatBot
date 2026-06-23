/**
 * @file services/index.js
 * @description Barrel file for service layer modules.
 *              Services encapsulate business logic and external integrations
 *              (LangChain, OpenAI, vector stores, etc.).
 *
 * Example:
 *   module.exports.ragService      = require('./ragService');
 *   module.exports.documentService = require('./documentService');
 */

module.exports = {
  documentService: require('./documentService'),
  pdfService     : require('./pdfService'),
  docxService    : require('./docxService'),
  txtService     : require('./txtService'),
};

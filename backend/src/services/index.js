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
  documentService  : require('./documentService'),
  processingService: require('./processingService'),
  pdfService       : require('./pdfService'),
  docxService      : require('./docxService'),
  txtService       : require('./txtService'),
  chunkingService  : require('./chunkingService'),
  chunkStorageService: require('./chunkStorageService'),
  embeddingService: require('./embeddingService'),
  embeddingPipelineService: require('./embeddingPipelineService'),
  queryEmbeddingService: require('./queryEmbeddingService'),
  similaritySearchService: require('./similaritySearchService'),
  retrievalService: require('./retrievalService'),
  llmService: require('./llmService'),
  promptBuilderService: require('./promptBuilderService'),
  ragService: require('./ragService'),
  conversationService: require('./conversationService'),
  citationBuilderService: require('./citationBuilderService'),
  analyticsService: require('./analyticsService'),
  cacheService: require('./cacheService'),
  insightsService: require('./insightsService'),
};

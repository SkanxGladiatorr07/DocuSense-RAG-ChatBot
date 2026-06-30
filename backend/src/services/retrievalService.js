/**
 * @file services/retrievalService.js
 * @description RAG retrieval service: question → embedding → ranked chunks + document metadata.
 *
 *   Composes two existing services in a single call:
 *     1. queryEmbeddingService.embedQuery()      — question → vector
 *     2. similaritySearchService.findSimilarChunks() — vector → top-K chunks
 *
 *   Then enriches each result with its parent document's metadata
 *   (originalName, fileType, uploadDate, status) using a single batched
 *   DB lookup so chat endpoints receive everything they need in one call.
 *
 *   Public API
 *   ──────────
 *   retrieve(question, options) → Promise<RetrievalResult>
 *
 *   RetrievalResult shape
 *   ─────────────────────
 *   {
 *     question : string,                   // normalised question echoed back
 *     topK     : number,                   // number of chunks returned
 *     results  : Array<{
 *       chunkId            : string,
 *       chunkIndex         : number,
 *       content            : string,
 *       score              : number,        // cosine similarity (0 – 1)
 *       wordCount          : number,
 *       metadata           : object,
 *       sourceDocumentName : string|null,   // from chunk snapshot (preferred)
 *       pageNumber         : number|null,   // from chunk snapshot (null = N/A)
 *       uploadedAt         : Date|null,     // from chunk snapshot
 *       document           : {              // parent document metadata
 *         documentId  : string,
 *         originalName: string,
 *         fileType    : string,
 *         uploadDate  : Date,
 *         status      : string,
 *       },
 *     }>,
 *   }
 */

const { Document }              = require('../models');
const { embedQuery }            = require('./queryEmbeddingService');
const { findSimilarChunks }     = require('./similaritySearchService');
const AppError                  = require('../utils/AppError');
const logger                    = require('../utils/logger');

// ── retrieve ──────────────────────────────────────────────────────────────────

/**
 * Retrieve the most semantically relevant chunks for a natural language question.
 *
 * @param {string} question              - Raw user question string.
 * @param {object} [options={}]
 * @param {number} [options.topK=5]     - Maximum chunks to return.
 * @param {string} [options.documentId] - Restrict search to one document.
 * @param {number} [options.minScore=0] - Minimum cosine similarity threshold (0–1).
 *
 * @returns {Promise<{
 *   question: string,
 *   topK    : number,
 *   results : Array<object>,
 * }>}
 *
 * @throws {AppError} 400 – invalid question or options
 * @throws {AppError} 404 – no embedded chunks available
 * @throws {AppError} 502 – Gemini API failure
 */
const retrieve = async (question, options = {}) => {
  const { topK = 5, documentId = undefined, minScore = 0 } = options;

  // ── 1. Input guard ─────────────────────────────────────────────────────────
  if (typeof question !== 'string' || !question.trim()) {
    throw AppError.badRequest('retrievalService.retrieve: question must be a non-empty string.');
  }

  const normalisedQuestion = question.trim();
  logger.info(`[retrievalService] Retrieving chunks for question: "${normalisedQuestion.slice(0, 80)}${normalisedQuestion.length > 80 ? '…' : ''}"`);

  // ── 2. Embed the question ─────────────────────────────────────────────────
  const queryVector = await embedQuery(normalisedQuestion);

  // ── 3. Search for similar chunks ──────────────────────────────────────────
  const searchResults = await findSimilarChunks(queryVector, {
    topK,
    documentId,
    minScore,
  });

  if (searchResults.length === 0) {
    logger.warn('[retrievalService] No chunks met the similarity threshold.');
    return {
      question: normalisedQuestion,
      topK    : 0,
      results : [],
    };
  }

  // ── 4. Batch-fetch parent document metadata ───────────────────────────────
  // Collect unique documentIds from results; one DB round-trip for all of them.
  const uniqueDocIds = [...new Set(searchResults.map((r) => r.documentId))];

  const docs = await Document.find({ _id: { $in: uniqueDocIds } })
    .select('_id originalName fileType uploadDate status')
    .lean();

  // Build a fast O(1) lookup map: documentId string → metadata object
  const docMap = Object.fromEntries(
    docs.map((d) => [
      d._id.toString(),
      {
        documentId  : d._id.toString(),
        originalName: d.originalName,
        fileType    : d.fileType,
        uploadDate  : d.uploadDate,
        status      : d.status,
      },
    ])
  );

  // ── 5. Merge chunk results with document metadata ─────────────────────────
  const enrichedResults = searchResults.map((r) => {
    const docMeta = docMap[r.documentId] ?? {
      documentId  : r.documentId,
      originalName: 'Unknown',
      fileType    : 'unknown',
      uploadDate  : null,
      status      : 'unknown',
    };

    return {
      chunkId   : r.chunkId,
      chunkIndex: r.chunkIndex,
      content   : r.content,
      score     : r.score,
      wordCount : r.wordCount,
      metadata  : r.metadata,

      // ── Provenance fields ────────────────────────────────────────────────
      // Prefer the chunk's own snapshot over the live Document record so that
      // citations remain accurate even if the document was later renamed.
      sourceDocumentName: r.sourceDocumentName ?? docMeta.originalName ?? null,
      pageNumber        : r.pageNumber         ?? null,
      uploadedAt        : r.uploadedAt         ?? docMeta.uploadDate   ?? null,

      // ── Live document metadata ───────────────────────────────────────────────
      document: docMeta,
    };
  });

  logger.info(
    `[retrievalService] Retrieved ${enrichedResults.length} chunk(s) ` +
    `across ${uniqueDocIds.length} document(s). ` +
    `Top score: ${enrichedResults[0]?.score ?? 'N/A'}`
  );

  return {
    question: normalisedQuestion,
    topK    : enrichedResults.length,
    results : enrichedResults,
  };
};

module.exports = { retrieve };

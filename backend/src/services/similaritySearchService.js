/**
 * @file services/similaritySearchService.js
 * @description Semantic similarity search over stored document chunk embeddings.
 *
 *   Current implementation: in-process cosine similarity over MongoDB chunks.
 *   Future upgrade path: replace `mongoAdapter.search()` with a Pinecone /
 *   ChromaDB adapter; the public API (`findSimilarChunks`) stays unchanged.
 *
 *   Public API
 *   ──────────
 *   findSimilarChunks(queryVector, options) → Promise<SearchResult[]>
 *
 *   SearchResult shape
 *   ──────────────────
 *   {
 *     chunkId            : string,        // Chunk._id
 *     documentId         : string,        // parent Document._id
 *     chunkIndex         : number,        // position in source document
 *     content            : string,        // raw text of the chunk
 *     score              : number,        // cosine similarity (0 – 1)
 *     wordCount          : number,
 *     metadata           : object,
 *     sourceDocumentName : string|null,   // snapshot of Document.originalName
 *     pageNumber         : number|null,   // page hint from extractor (null = N/A)
 *     uploadedAt         : Date|null,     // snapshot of Document.uploadDate
 *   }
 */

const { Chunk } = require('../models');
const AppError  = require('../utils/AppError');
const logger    = require('../utils/logger');

// ── Math helpers ──────────────────────────────────────────────────────────────

/**
 * Compute the dot product of two numeric arrays.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
const dotProduct = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

/**
 * Compute the L2 (Euclidean) magnitude of a vector.
 *
 * @param {number[]} v
 * @returns {number}
 */
const magnitude = (v) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns a value in the range [0, 1] for normalised embeddings.
 *
 * Returns 0 instead of throwing when either vector has zero magnitude
 * (degenerate case — zero-vector embeddings should not exist in practice).
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
const cosineSimilarity = (a, b) => {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
};

// ── MongoDB adapter ───────────────────────────────────────────────────────────
//
//   This object is the ONLY place that touches MongoDB.
//   Swap it for a Pinecone / ChromaDB client adapter later without touching
//   findSimilarChunks or any caller.

const mongoAdapter = {
  /**
   * Fetch all chunks that have an embedding vector, optionally filtered to
   * a specific document.
   *
   * @param {object} filter  – additional Mongoose query conditions
   * @returns {Promise<import('mongoose').Document[]>}
   */
  async fetchEmbeddedChunks(filter = {}) {
    // Only load fields the scorer actually needs — skip heavy text in lean()
    // but keep content so callers can display it in the RAG context window.
    return Chunk.find({
      ...filter,
      embedding: { $exists: true, $not: { $size: 0 } },
    })
      .select(
        'documentId chunkIndex content wordCount metadata embedding ' +
        'sourceDocumentName pageNumber uploadedAt'
      )
      .lean();
  },
};

// ── findSimilarChunks ─────────────────────────────────────────────────────────

/**
 * Find the top-K chunks whose stored embedding is most similar to queryVector.
 *
 * @param {number[]} queryVector - Embedding of the user's question.
 * @param {object}  [options={}]
 * @param {number}  [options.topK=5]           - Maximum results to return.
 * @param {string}  [options.documentId]       - Restrict search to one document.
 * @param {number}  [options.minScore=0]       - Minimum similarity threshold (0–1).
 *
 * @returns {Promise<Array<{
 *   chunkId            : string,
 *   documentId         : string,
 *   chunkIndex         : number,
 *   content            : string,
 *   score              : number,
 *   wordCount          : number,
 *   metadata           : object,
 *   sourceDocumentName : string|null,
 *   pageNumber         : number|null,
 *   uploadedAt         : Date|null,
 * }>>} Top-K results sorted descending by cosine similarity score.
 *
 * @throws {AppError} 400 – invalid queryVector
 * @throws {AppError} 404 – no embedded chunks found to search
 */
const findSimilarChunks = async (queryVector, options = {}) => {
  const {
    topK       = 5,
    documentId = undefined,
    minScore   = 0,
  } = options;

  // ── 1. Validate query vector ───────────────────────────────────────────────
  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw AppError.badRequest(
      'similaritySearchService.findSimilarChunks: queryVector must be a non-empty number array.'
    );
  }

  if (typeof topK !== 'number' || topK < 1) {
    throw AppError.badRequest('similaritySearchService.findSimilarChunks: topK must be a positive integer.');
  }

  // ── 2. Fetch candidate chunks ─────────────────────────────────────────────
  const filter = documentId ? { documentId } : {};
  const chunks = await mongoAdapter.fetchEmbeddedChunks(filter);

  logger.info(
    `[similaritySearch] Scoring ${chunks.length} embedded chunk(s)` +
    (documentId ? ` (document: ${documentId})` : ' (all documents)')
  );

  if (chunks.length === 0) {
    throw AppError.notFound(
      documentId
        ? 'No embedded chunks found for this document. Run the /embed endpoint first.'
        : 'No embedded chunks found in the database. Upload, process, chunk and embed documents first.'
    );
  }

  // ── 3. Score every chunk ──────────────────────────────────────────────────
  const scored = chunks
    .map((chunk) => {
      // Gracefully skip chunks whose stored embedding has a different dimension
      if (chunk.embedding.length !== queryVector.length) {
        logger.warn(
          `[similaritySearch] Dimension mismatch on chunk ${chunk._id} ` +
          `(stored: ${chunk.embedding.length}, query: ${queryVector.length}) — skipping.`
        );
        return null;
      }

      return {
        chunkId            : chunk._id.toString(),
        documentId         : chunk.documentId.toString(),
        chunkIndex         : chunk.chunkIndex,
        content            : chunk.content,
        wordCount          : chunk.wordCount,
        metadata           : chunk.metadata,
        score              : parseFloat(cosineSimilarity(queryVector, chunk.embedding).toFixed(6)),
        // ── Provenance fields (null for pre-extension chunks) ──
        sourceDocumentName : chunk.sourceDocumentName ?? null,
        pageNumber         : chunk.pageNumber         ?? null,
        uploadedAt         : chunk.uploadedAt         ?? null,
      };
    })
    .filter((r) => r !== null && r.score >= minScore);

  // ── 4. Rank & trim to topK ────────────────────────────────────────────────
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  logger.info(
    `[similaritySearch] Returning ${results.length} result(s). ` +
    (results.length ? `Top score: ${results[0].score}` : 'No results above threshold.')
  );

  return results;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  findSimilarChunks,
  // Exposed for testing / future adapter replacement:
  _mongoAdapter    : mongoAdapter,
  _cosineSimilarity: cosineSimilarity,
};

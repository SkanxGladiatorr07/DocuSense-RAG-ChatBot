/**
 * @file services/queryEmbeddingService.js
 * @description Query embedding service for the RAG retrieval pipeline.
 *
 *   Accepts a raw user question, validates and normalises it, then delegates
 *   to embeddingService.generateEmbedding using the same Gemini model used
 *   for document chunk embeddings. This guarantees that query and chunk
 *   vectors live in the same embedding space — a hard requirement for
 *   meaningful cosine / dot-product similarity search.
 *
 *   Keeping this as a dedicated service (rather than calling embeddingService
 *   directly from the chat controller) means:
 *   - Query-specific guards and normalisation live in one place.
 *   - The chat controller stays thin: validate → delegate → respond.
 *   - Swapping the embedding model later only requires a change here.
 *
 *   Public API
 *   ──────────
 *   embedQuery(question) → Promise<number[]>
 */

const { generateEmbedding } = require('./embeddingService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Soft word-count limit for a single query.
 *
 * Gemini text-embedding-004 has a token ceiling (~2048 tokens).
 * A conservative word cap keeps us safely within that boundary even
 * with high average tokens-per-word documents.
 */
const MAX_QUERY_WORDS = 2000;

/**
 * Generate a vector embedding for a user query string.
 *
 * Validates that the input is a non-empty string within the model's
 * token capacity, then delegates to embeddingService.generateEmbedding
 * using the default model (text-embedding-004) — identical to the model
 * used during document chunk ingestion.
 *
 * @param {string} question - Raw question text from the user.
 * @returns {Promise<number[]>} Embedding vector (768 dimensions for text-embedding-004).
 * @throws {AppError} 400 – If input is not a string, is empty, or exceeds word limit.
 * @throws {AppError} 502 – If the Gemini API call fails.
 */
const embedQuery = async (question) => {
  // ── 1. Type guard ───────────────────────────────────────────────────────────
  if (typeof question !== 'string') {
    throw AppError.badRequest(
      'queryEmbeddingService.embedQuery: question must be a string.'
    );
  }

  // ── 2. Normalise whitespace ─────────────────────────────────────────────────
  const normalised = question.trim().replace(/\s+/g, ' ');

  if (!normalised) {
    throw AppError.badRequest('Query cannot be empty.');
  }

  // ── 3. Word-count soft cap ──────────────────────────────────────────────────
  const wordCount = normalised.split(' ').length;
  if (wordCount > MAX_QUERY_WORDS) {
    throw AppError.badRequest(
      `Query is too long (${wordCount} words). ` +
      `Maximum allowed is ${MAX_QUERY_WORDS} words.`
    );
  }

  logger.info(`[queryEmbeddingService] Embedding query (${wordCount} words): "${normalised.slice(0, 80)}${normalised.length > 80 ? '…' : ''}"`);

  // ── 4. Delegate to embeddingService (same model as chunk ingestion) ─────────
  const vector = await generateEmbedding(normalised);

  logger.info(`[queryEmbeddingService] Query embedded successfully. Dimensions: ${vector.length}`);

  return vector;
};

module.exports = { embedQuery };

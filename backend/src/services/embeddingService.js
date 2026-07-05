/**
 * @file services/embeddingService.js
 * @description Embedding generation service using Google's Gemini Developer API.
 *
 *   Converts plain text into high-dimensional float vectors (embeddings)
 *   to support semantic search in the RAG pipeline.
 *
 *   Public API
 *   ──────────
 *   generateEmbedding(text, [options]) -> Promise<number[]>
 */

const env = require('../config/env');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/** Latest standard Gemini text embedding model. */
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2';

/**
 * Generate a vector embedding for the given input text.
 *
 * Uses the native Node.js global fetch to communicate directly with Google's
 * Generative Language REST API. Avoids version conflicts and runtime overhead
 * associated with heavy wrapper libraries.
 *
 * @param {string} text - The input string to embed.
 * @param {object} [options={}]
 * @param {string} [options.model='text-embedding-004'] - The Gemini model to target.
 * @returns {Promise<number[]>} Array of floating point numbers (vector embedding).
 * @throws {AppError} 400 - If parameters are invalid or API key is missing.
 * @throws {AppError} 502 - If the Gemini API returns a bad status or network error.
 */
const generateEmbedding = async (text, options = {}) => {
  const model = options.model || DEFAULT_EMBEDDING_MODEL;

  // ── 1. Validation ──────────────────────────────────────────────────────────
  if (typeof text !== 'string') {
    throw AppError.badRequest('embeddingService.generateEmbedding: input text must be a string.');
  }

  const cleanText = text.trim();
  if (!cleanText) {
    throw AppError.badRequest('embeddingService.generateEmbedding: input text cannot be empty.');
  }

  const apiKey = env.geminiApiKey;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    logger.warn('[embeddingService] GEMINI_API_KEY is missing or set to placeholder. Running in MOCK mode.');
    // Return a mock vector of 768 dimensions (standard size for text-embedding-004)
    const mockVector = Array.from({ length: 768 }, (_, i) => Math.sin(i) * 0.1);
    return mockVector;
  }

  logger.info(`[embeddingService] Generating embedding using model: ${model} (${cleanText.length} chars)`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

  // ── 2. Call Google Gemini REST API ─────────────────────────────────────────
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: {
          parts: [
            {
              text: cleanText,
            },
          ],
        },
        outputDimensionality: 768
      }),
    });

    // ── 3. Handle HTTP Errors ────────────────────────────────────────────────
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read response body.';
      }

      logger.error(
        `[embeddingService] Gemini API returned error status: ${response.status} | Body: ${errorBody}`
      );

      // Parse JSON error response if possible to throw a cleaner error message
      let parsedMsg = `Gemini API returned status ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error && parsed.error.message) {
          parsedMsg = parsed.error.message;
        }
      } catch {
        // Fall back to raw text / default status message
      }

      throw new AppError(
        502, // Bad Gateway — the external Gemini service failed
        `Gemini Embedding API Failure: ${parsedMsg}`
      );
    }

    // ── 4. Extract and validate response vector ──────────────────────────────
    const data = await response.json();

    if (!data.embedding || !Array.isArray(data.embedding.values)) {
      logger.error(
        `[embeddingService] Gemini API returned unexpected payload shape: ${JSON.stringify(data)}`
      );
      throw AppError.internal('Gemini API response did not contain valid embedding values.');
    }

    const vector = data.embedding.values;
    logger.info(`[embeddingService] Successfully generated embedding. Dimensions: ${vector.length}`);
    return vector;

  } catch (err) {
    // If it's already an instance of AppError, re-throw it
    if (err instanceof AppError) {
      throw err;
    }

    // Capture connection/timeout/network errors
    logger.error(`[embeddingService] Network or parsing failure: ${err.message}`);
    throw new AppError(
      502,
      `Failed to connect to Gemini Embedding API: ${err.message}`
    );
  }
};

/**
 * Generate vector embeddings for an array of input texts in a single batch request.
 *
 * @param {string[]} texts - Array of input strings to embed.
 * @param {object} [options={}]
 * @param {string} [options.model='gemini-embedding-2'] - The Gemini model to target.
 * @returns {Promise<number[][]>} Array of float vectors.
 */
const generateEmbeddingsBatch = async (texts, options = {}) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw AppError.badRequest('embeddingService.generateEmbeddingsBatch: texts must be a non-empty array.');
  }

  const model = options.model || DEFAULT_EMBEDDING_MODEL;
  const apiKey = env.geminiApiKey;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    logger.warn('[embeddingService] GEMINI_API_KEY is missing or set to placeholder. Running in MOCK mode.');
    // Return mock vectors of 768 dimensions for each text
    return texts.map(() => Array.from({ length: 768 }, (_, i) => Math.sin(i) * 0.1));
  }

  logger.info(`[embeddingService] Generating batch embeddings using model: ${model} for ${texts.length} items`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${model}`,
          content: {
            parts: [{ text: t.trim() || ' ' }],
          },
          outputDimensionality: 768
        })),
      }),
    });

    if (!response.ok) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch { errorBody = 'Unable to read response body.'; }
      logger.error(`[embeddingService] Gemini API returned error status: ${response.status} | Body: ${errorBody}`);
      let parsedMsg = `Gemini API returned status ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error && parsed.error.message) parsedMsg = parsed.error.message;
      } catch {}
      throw new AppError(502, `Gemini Embedding API Failure: ${parsedMsg}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.embeddings)) {
      throw AppError.internal('Gemini API returned an invalid response shape for batch embeddings.');
    }

    return data.embeddings.map((emb) => emb.values);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(`[embeddingService] Network failure during batch embedding: ${err.message}`);
    throw new AppError(502, `Gemini Embedding API network failure: ${err.message}`);
  }
};

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
};

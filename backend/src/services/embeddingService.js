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
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';

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
    throw AppError.badRequest(
      'embeddingService: Gemini API key is missing or set to placeholder value. ' +
      'Please update GEMINI_API_KEY in your .env file.'
    );
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

module.exports = {
  generateEmbedding,
};

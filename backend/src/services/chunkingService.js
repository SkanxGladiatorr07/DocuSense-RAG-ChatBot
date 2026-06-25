/**
 * @file services/chunkingService.js
 * @description Text chunking service for the RAG ingestion pipeline.
 *
 *   Splits document text into chunks of a target word count while
 *   preserving sentence boundaries when possible to maintain semantic cohesion.
 *
 *   Public API
 *   ──────────
 *   chunkText(text, [options]) -> Array<{ chunkIndex: number, content: string, wordCount: number }>
 */

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/** Default target chunk size in words. */
const DEFAULT_CHUNK_SIZE = 500;

/**
 * Split text into individual sentences, preserving punctuation and trailing spacing.
 *
 * @param {string} text - Raw text content
 * @returns {string[]} Array of sentences
 */
const splitIntoSentences = (text) => {
  if (!text) return [];

  // Match sentences including their ending punctuation (. ! ?) or newlines.
  // The expression matches non-punctuation characters followed by sentence ending punctuation or end-of-string.
  const sentenceRegex = /[^.!?\n]+(?:[.!?]+|\n+|$)/g;
  const matches = text.match(sentenceRegex) || [];

  return matches
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Calculate the word count of a given string.
 *
 * @param {string} text
 * @returns {number} Number of words
 */
const getWordCount = (text) => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * Splits extracted text into semantic chunks of a target word count.
 *
 * Preserves sentence boundaries. If a single sentence is larger than
 * the target chunk size, it is split by words to stay within constraints.
 *
 * @param {string} text - The raw text content of the document to be chunked.
 * @param {object} [options={}]
 * @param {number} [options.targetChunkSize=500] - Target size of each chunk in words.
 * @returns {Array<{ chunkIndex: number, content: string, wordCount: number }>} Collection of chunk objects.
 * @throws {AppError} 400 - If input parameters are invalid.
 */
const chunkText = (text, options = {}) => {
  const targetChunkSize = options.targetChunkSize || DEFAULT_CHUNK_SIZE;

  // ── 1. Validate inputs ────────────────────────────────────────────────────
  if (typeof text !== 'string') {
    throw AppError.badRequest('chunkingService.chunkText: input text must be a string.');
  }

  if (typeof targetChunkSize !== 'number' || targetChunkSize <= 0) {
    throw AppError.badRequest('chunkingService.chunkText: targetChunkSize must be a positive number.');
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    logger.warn('[chunkingService] Received empty text input for chunking.');
    return [];
  }

  const totalWords = getWordCount(trimmedText);
  logger.info(`[chunkingService] Starting chunking. Total words: ${totalWords} | Target size: ${targetChunkSize}`);

  // ── 2. Split into sentences ───────────────────────────────────────────────
  const sentences = splitIntoSentences(trimmedText);
  const chunks = [];
  let currentSentences = [];
  let currentWordCount = 0;
  let chunkIndex = 0;

  // ── 3. Group sentences into chunks ────────────────────────────────────────
  for (const sentence of sentences) {
    const sentenceWordCount = getWordCount(sentence);

    // Case A: Single sentence is larger than the target chunk size.
    // We split it strictly by words so we don't produce massive outlier chunks.
    if (sentenceWordCount > targetChunkSize) {
      // Flush current accumulated sentences first
      if (currentSentences.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: currentSentences.join(' '),
          wordCount: currentWordCount,
        });
        currentSentences = [];
        currentWordCount = 0;
      }

      // Split the giant sentence by words
      const words = sentence.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += targetChunkSize) {
        const chunkWords = words.slice(i, i + targetChunkSize);
        const chunkContent = chunkWords.join(' ');
        chunks.push({
          chunkIndex: chunkIndex++,
          content: chunkContent,
          wordCount: chunkWords.length,
        });
      }
      continue;
    }

    // Case B: Adding this sentence exceeds target size.
    // We close the current chunk and start a new one.
    if (currentWordCount + sentenceWordCount > targetChunkSize && currentSentences.length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentSentences.join(' '),
        wordCount: currentWordCount,
      });
      currentSentences = [];
      currentWordCount = 0;
    }

    // Accumulate the sentence
    currentSentences.push(sentence);
    currentWordCount += sentenceWordCount;
  }

  // ── 4. Flush remaining sentences ──────────────────────────────────────────
  if (currentSentences.length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      content: currentSentences.join(' '),
      wordCount: currentWordCount,
    });
  }

  logger.info(`[chunkingService] Chunking complete. Generated ${chunks.length} chunks.`);
  return chunks;
};

module.exports = {
  chunkText,
};

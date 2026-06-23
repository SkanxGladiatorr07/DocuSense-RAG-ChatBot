/**
 * @file services/txtService.js
 * @description Reusable plain-text extraction service using native Node.js fs.
 *
 *   Responsibilities
 *   ────────────────
 *   • Read a .txt file from an absolute file path
 *   • Decode the content with a configurable encoding (defaults to UTF-8)
 *   • Return extracted text alongside lightweight metadata (line count, size)
 *   • Surface failures as structured AppErrors so callers respond uniformly
 *     without reaching into fs directly
 *
 *   Public API
 *   ──────────
 *   extractText(filePath, [options])  → { text, lineCount, charCount, encoding }
 *   isTxt(filePath)                   → boolean  (quick extension check)
 *
 *   Return shape mirrors pdfService.extractText() and docxService.extractText()
 *   where fields overlap so documentService can treat all extractors uniformly.
 */

const fs   = require('fs');
const path = require('path');

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default character encoding used when reading plain-text files. */
const DEFAULT_ENCODING = 'utf8';

/** Minimum content length (chars) to consider extraction successful. */
const MIN_TEXT_LENGTH = 1;

/**
 * Node.js supported Buffer encodings we allow callers to request.
 * Keeping this explicit prevents callers from passing arbitrary strings.
 */
const SUPPORTED_ENCODINGS = new Set([
  'utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'base64', 'hex',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verify the file at `filePath` exists and is readable.
 * Gives a clear 404/500 instead of a cryptic ENOENT from fs.
 *
 * @param {string} filePath  Absolute path to the file
 * @throws {AppError}
 */
const _assertFileReadable = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw AppError.badRequest('txtService.extractText: filePath must be a non-empty string.');
  }

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound(`TXT file not found at path: ${path.basename(filePath)}`);
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    throw AppError.internal(`TXT file exists but is not readable: ${path.basename(filePath)}`);
  }
};

// ── extractText ───────────────────────────────────────────────────────────────

/**
 * Extract the full text content of a plain-text file.
 *
 * Uses synchronous fs.readFileSync internally — plain-text files in the RAG
 * context are small (≤ 10 MB by the upload guard) so there is no value in
 * an async stream; a single synchronous read is simpler and equally fast.
 *
 * @param {string} filePath  Absolute path to the uploaded TXT file
 * @param {object} [options={}]
 * @param {string} [options.encoding='utf8']  Buffer encoding to use when
 *   reading the file.  Must be one of SUPPORTED_ENCODINGS.
 *
 * @returns {{
 *   text     : string,   // Full raw text content
 *   lineCount: number,   // Number of lines in the document
 *   charCount: number,   // Character count (post-trim)
 *   encoding : string,   // Encoding actually used
 * }}
 *
 * @throws {AppError} 400 – invalid argument or unsupported encoding
 * @throws {AppError} 404 – file not found on disk
 * @throws {AppError} 422 – file is empty or contains no usable text
 * @throws {AppError} 500 – unexpected I/O error
 */
const extractText = (filePath, { encoding = DEFAULT_ENCODING } = {}) => {
  // ── 1. Pre-flight checks ──────────────────────────────────────────────────
  _assertFileReadable(filePath);

  // Validate encoding so we produce a clear 400 instead of a Node crash
  const normEncoding = encoding.toLowerCase();
  if (!SUPPORTED_ENCODINGS.has(normEncoding)) {
    throw AppError.badRequest(
      `Unsupported encoding "${encoding}". ` +
      `Allowed values: ${[...SUPPORTED_ENCODINGS].join(', ')}.`
    );
  }

  const fileName = path.basename(filePath);
  logger.info(`[txtService] Starting text extraction → ${fileName} (${normEncoding})`);

  // ── 2. Read file ──────────────────────────────────────────────────────────
  let rawContent;
  try {
    rawContent = fs.readFileSync(filePath, { encoding: normEncoding });
  } catch (ioErr) {
    logger.error(`[txtService] Failed to read file: ${ioErr.message}`);
    throw AppError.internal(`Could not read TXT file: ${fileName}`);
  }

  // ── 3. Validate content ───────────────────────────────────────────────────
  const rawText = rawContent.trim();

  if (rawText.length < MIN_TEXT_LENGTH) {
    logger.warn(`[txtService] No text content found in: ${fileName}`);
    throw AppError.unprocessable(
      `No text could be extracted from "${fileName}". The file appears to be empty.`
    );
  }

  // ── 4. Compute metadata ───────────────────────────────────────────────────
  // Count lines on the original (un-trimmed) content to preserve newline
  // semantics, then fall back to 1 if the file is a single line with no \n.
  const lineCount = rawContent.split('\n').length;
  const charCount = rawText.length;

  logger.info(
    `[txtService] Extraction complete → ${fileName} | ` +
    `lines: ${lineCount} | chars: ${charCount}`
  );

  // ── 5. Return structured result ───────────────────────────────────────────
  return {
    text     : rawText,
    lineCount,
    charCount,
    encoding : normEncoding,
  };
};

// ── isTxt ─────────────────────────────────────────────────────────────────────

/**
 * Lightweight check: does the file path have a .txt extension?
 *
 * Does NOT read file contents (use only as a quick guard before attempting
 * a more expensive operation).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
const isTxt = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return false;
  return path.extname(filePath).toLowerCase() === '.txt';
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { extractText, isTxt };

/**
 * @file services/docxService.js
 * @description Reusable DOCX text-extraction service built on top of mammoth.
 *
 *   Responsibilities
 *   ────────────────
 *   • Read a DOCX file from an absolute file path
 *   • Extract the full plain-text content via mammoth.extractRawText()
 *   • Collect any mammoth conversion messages (warnings) for transparency
 *   • Return extracted text alongside useful metadata (word count, warnings)
 *   • Surface extraction failures as structured AppErrors so callers respond
 *     uniformly without importing mammoth directly
 *
 *   Public API
 *   ──────────
 *   extractText(filePath)  → { text, wordCount, warnings }
 *   isDocx(filePath)       → boolean  (quick extension check)
 *
 *   Return shape mirrors pdfService.extractText() where fields overlap so
 *   documentService can treat all extractors uniformly.
 */

const fs      = require('fs');
const path    = require('path');
const mammoth = require('mammoth');

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum content length (chars) to consider extraction successful. */
const MIN_TEXT_LENGTH = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verify the file at `filePath` exists and is readable before handing it
 * to mammoth.  Gives a clear 404/500 error instead of a cryptic ENOENT.
 *
 * @param {string} filePath  Absolute path to the file
 * @throws {AppError}
 */
const _assertFileReadable = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw AppError.badRequest('docxService.extractText: filePath must be a non-empty string.');
  }

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound(`DOCX file not found at path: ${path.basename(filePath)}`);
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    throw AppError.internal(`DOCX file exists but is not readable: ${path.basename(filePath)}`);
  }
};

// ── extractText ───────────────────────────────────────────────────────────────

/**
 * Extract full plain-text content from a DOCX file.
 *
 * Uses mammoth.extractRawText() rather than the HTML conversion path so the
 * result is clean prose without markup.  mammoth reads the file path directly
 * (no need to buffer manually), making the operation straightforward.
 *
 * @param {string} filePath  Absolute path to the uploaded DOCX file
 *
 * @returns {Promise<{
 *   text     : string,    // Full extracted plain text
 *   wordCount: number,    // Rough word count (whitespace-split)
 *   warnings : string[],  // Mammoth conversion warnings (e.g. unsupported elements)
 * }>}
 *
 * @throws {AppError} 400 – invalid argument
 * @throws {AppError} 404 – file not found on disk
 * @throws {AppError} 422 – DOCX parsed but contained no extractable text
 * @throws {AppError} 422 – file is not a valid DOCX / is corrupted
 * @throws {AppError} 500 – unexpected internal / mammoth error
 */
const extractText = async (filePath) => {
  // ── 1. Pre-flight checks ──────────────────────────────────────────────────
  _assertFileReadable(filePath);

  const fileName = path.basename(filePath);
  logger.info(`[docxService] Starting text extraction → ${fileName}`);

  // ── 2. Parse DOCX with mammoth ────────────────────────────────────────────
  let result;
  try {
    // mammoth accepts { path } and reads the file internally
    result = await mammoth.extractRawText({ path: filePath });
  } catch (parseErr) {
    const msg = parseErr.message || '';
    logger.error(`[docxService] mammoth error for ${fileName}: ${msg}`);

    // Classify common failure modes into actionable client errors
    if (
      msg.includes('End of central directory record signature') ||
      msg.includes('invalid signature') ||
      msg.includes('Corrupted zip') ||
      msg.includes('bad local file header') ||
      msg.includes('not a zip file')
    ) {
      throw AppError.unprocessable(
        `The file "${fileName}" does not appear to be a valid DOCX or is corrupted.`
      );
    }

    // Anything else is treated as an unexpected server error
    throw AppError.internal(`DOCX parsing failed for "${fileName}": ${msg}`);
  }

  // ── 3. Validate extracted content ─────────────────────────────────────────
  const rawText = (result.value || '').trim();

  if (rawText.length < MIN_TEXT_LENGTH) {
    logger.warn(`[docxService] No extractable text found in: ${fileName}`);
    throw AppError.unprocessable(
      `No text could be extracted from "${fileName}". ` +
      'The document may be empty or contain only images/embedded objects.'
    );
  }

  // Collect human-readable warning messages from mammoth
  const warnings = (result.messages || [])
    .filter((m) => m.type === 'warning')
    .map((m) => m.message);

  if (warnings.length > 0) {
    logger.warn(`[docxService] Conversion warnings for ${fileName}:`, warnings);
  }

  // Rough word count: split on any whitespace sequence, ignore empty tokens
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  logger.info(
    `[docxService] Extraction complete → ${fileName} | ` +
    `words: ${wordCount} | chars: ${rawText.length} | warnings: ${warnings.length}`
  );

  // ── 4. Return structured result ───────────────────────────────────────────
  return {
    text     : rawText,
    wordCount,
    warnings,
  };
};

// ── isDocx ────────────────────────────────────────────────────────────────────

/**
 * Lightweight check: does the file path have a .docx extension?
 *
 * Does NOT read file contents (use only as a quick guard before attempting
 * a more expensive parse).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
const isDocx = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return false;
  return path.extname(filePath).toLowerCase() === '.docx';
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { extractText, isDocx };

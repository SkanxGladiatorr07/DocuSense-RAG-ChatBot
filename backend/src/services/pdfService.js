/**
 * @file services/pdfService.js
 * @description Reusable PDF text-extraction service built on top of pdf-parse.
 *
 *   Responsibilities
 *   ────────────────
 *   • Read a PDF from an absolute file path
 *   • Extract the full text content
 *   • Return extracted text alongside useful metadata (pages, info, etc.)
 *   • Surface extraction failures as structured AppErrors so callers can
 *     respond uniformly without importing pdf-parse directly
 *
 *   Public API
 *   ──────────
 *   extractText(filePath)  → { text, numPages, info, metadata }
 *   isPdf(filePath)        → boolean  (quick MIME-free check via extension)
 */

const fs      = require('fs');
const path    = require('path');
const { PDFParse } = require('pdf-parse');

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum content length (chars) to consider extraction successful. */
const MIN_TEXT_LENGTH = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verify the file at `filePath` exists and is readable before handing it
 * to pdf-parse.  Gives a clear 400/404 error instead of a cryptic ENOENT.
 *
 * @param {string} filePath  Absolute path to the file
 * @throws {AppError}
 */
const _assertFileReadable = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw AppError.badRequest('pdfService.extractText: filePath must be a non-empty string.');
  }

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound(`PDF file not found at path: ${path.basename(filePath)}`);
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    throw AppError.internal(`PDF file exists but is not readable: ${path.basename(filePath)}`);
  }
};

// ── extractText ───────────────────────────────────────────────────────────────

/**
 * Extract full text content from a PDF file.
 *
 * Internally passes raw buffer bytes to pdf-parse so no temporary stream
 * is left open; the entire operation is synchronous from a file-system
 * perspective (one fs.readFileSync) and asynchronous for the CPU-bound
 * PDF parsing step.
 *
 * @param {string} filePath  Absolute path to the uploaded PDF
 *
 * @returns {Promise<{
 *   text     : string,   // Full extracted text (pages joined with newlines)
 *   numPages : number,   // Total page count reported by pdf-parse
 *   info     : object,   // PDF info dict (Author, Creator, Title, …)
 *   metadata : object,   // XMP metadata object (may be empty)
 * }>}
 *
 * @throws {AppError} 400 – invalid argument
 * @throws {AppError} 404 – file not found on disk
 * @throws {AppError} 422 – PDF parsed but contained no extractable text
 * @throws {AppError} 500 – unexpected internal / pdf-parse error
 */
const extractText = async (filePath) => {
  // ── 1. Pre-flight checks ──────────────────────────────────────────────────
  _assertFileReadable(filePath);

  const fileName = path.basename(filePath);
  logger.info(`[pdfService] Starting text extraction → ${fileName}`);

  // ── 2. Read file into buffer ───────────────────────────────────────────────
  let dataBuffer;
  try {
    dataBuffer = fs.readFileSync(filePath);
  } catch (ioErr) {
    logger.error(`[pdfService] Failed to read file buffer: ${ioErr.message}`);
    throw AppError.internal(`Could not read PDF file: ${fileName}`);
  }

  // ── 3. Parse PDF ──────────────────────────────────────────────────────────
  try {
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);

    const textResult = await parser.getText();
    const infoResult = await parser.getInfo().catch((err) => {
      logger.warn(`[pdfService] Failed to fetch PDF info, continuing without it: ${err.message}`);
      return { info: {}, metadata: {} };
    });

    const rawText = (textResult.text || '').trim();

    // ── 4. Validate extracted content ─────────────────────────────────────────
    if (rawText.length < MIN_TEXT_LENGTH) {
      logger.warn(`[pdfService] No extractable text found in: ${fileName}`);
      throw AppError.unprocessable(
        `No text could be extracted from "${fileName}". ` +
        'The PDF may contain only scanned images (OCR required) or be empty.'
      );
    }

    logger.info(
      `[pdfService] Extraction complete → ${fileName} | ` +
      `pages: ${textResult.total} | chars: ${rawText.length}`
    );

    // ── 5. Return structured result ───────────────────────────────────────────
    return {
      text    : rawText,
      numPages: textResult.total,
      info    : infoResult.info     || {},
      metadata: infoResult.metadata || {},
    };
  } catch (parseErr) {
    if (parseErr instanceof AppError) throw parseErr;

    const msg = parseErr.message || '';
    logger.error(`[pdfService] pdf-parse error for ${fileName}: ${msg}`);

    if (
      msg.includes('Invalid PDF') ||
      msg.includes('Bad XRef') ||
      msg.includes('XRef table not found') ||
      msg.includes('Cannot read') ||
      msg.includes('startxref')
    ) {
      throw AppError.unprocessable(
        `The file "${fileName}" does not appear to be a valid PDF or is corrupted.`
      );
    }

    if (msg.includes('Password')) {
      throw AppError.unprocessable(
        `The PDF "${fileName}" is password-protected and cannot be processed.`
      );
    }

    // Any other pdf-parse error → 500
    throw AppError.internal(`PDF parsing failed for "${fileName}": ${msg}`);
  }
};

// ── isPdf ─────────────────────────────────────────────────────────────────────

/**
 * Lightweight check: does the file path have a .pdf extension?
 *
 * Does NOT read file contents (use this only as a quick guard before
 * attempting a more expensive parse).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
const isPdf = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return false;
  return path.extname(filePath).toLowerCase() === '.pdf';
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { extractText, isPdf };

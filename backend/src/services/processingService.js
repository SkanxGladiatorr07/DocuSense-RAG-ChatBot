/**
 * @file services/processingService.js
 * @description Central document processing orchestrator.
 *
 *   This service owns the full "detect → route → extract → report" pipeline.
 *   It is intentionally decoupled from MongoDB so it can be called from:
 *     • HTTP request handlers (documentController)
 *     • Background job queues
 *     • CLI scripts / test harnesses
 *
 *   DB status updates (uploaded → processing → indexed / failed) are handled
 *   by documentService, which calls this service and owns the Mongoose layer.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                   Processing Pipeline                          │
 *   │                                                                 │
 *   │  filePath + mimeType                                            │
 *   │       │                                                         │
 *   │       ▼                                                         │
 *   │  detectFileType()  ──── validates MIME, resolves format label  │
 *   │       │                                                         │
 *   │       ▼                                                         │
 *   │  resolveExtractor() ─── maps format to the correct service     │
 *   │       │                                                         │
 *   │       ▼                                                         │
 *   │  extractor.extractText() ─── runs format-specific parser       │
 *   │       │                                                         │
 *   │       ▼                                                         │
 *   │  buildResult() ─── normalises output into a common envelope    │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 *   Public API
 *   ──────────
 *   detectFileType(mimeType)                → { format, mimeType, label }
 *   resolveExtractor(mimeType)              → extractorService
 *   processFile(filePath, mimeType)         → ProcessingResult
 *   SUPPORTED_MIME_TYPES                    → Set<string>  (read-only)
 *   STATUSES                               → { UPLOADED, PROCESSING, INDEXED, FAILED }
 */

const path = require('path');

const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');
const pdfService  = require('./pdfService');
const docxService = require('./docxService');
const txtService  = require('./txtService');

// ── Status constants ───────────────────────────────────────────────────────────

/**
 * Document processing status values — mirrors the enum in the Document model.
 * Import from here instead of hardcoding strings in controllers / jobs.
 *
 * @readonly
 * @enum {string}
 */
const STATUSES = Object.freeze({
  UPLOADED  : 'uploaded',
  PROCESSING: 'processing',
  INDEXED   : 'indexed',
  FAILED    : 'failed',
});

// ── Format registry ───────────────────────────────────────────────────────────

/**
 * Maps each supported MIME type to:
 *   format    — short internal key used in logs and result envelopes
 *   label     — human-readable display name
 *   extractor — the service module that handles this MIME type;
 *               must expose  extractText(filePath) → { text, ...metadata }
 *
 * Adding a new format later is a single-line change in this table.
 */
const FORMAT_REGISTRY = Object.freeze({
  'application/pdf': {
    format   : 'pdf',
    label    : 'PDF Document',
    extractor: pdfService,
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    format   : 'docx',
    label    : 'Word Document (DOCX)',
    extractor: docxService,
  },
  'text/plain': {
    format   : 'txt',
    label    : 'Plain Text',
    extractor: txtService,
  },
});

/**
 * Set of all supported MIME type strings.
 * Useful for upload validators and middleware that need a quick membership check.
 *
 * @type {ReadonlySet<string>}
 */
const SUPPORTED_MIME_TYPES = Object.freeze(new Set(Object.keys(FORMAT_REGISTRY)));

// ── detectFileType ────────────────────────────────────────────────────────────

/**
 * Identify the document format from its MIME type.
 *
 * This is a pure lookup — it reads no files and makes no I/O calls.
 * Use it as a cheap pre-flight guard before committing to extraction.
 *
 * @param {string} mimeType  MIME type string (e.g. 'application/pdf')
 *
 * @returns {{
 *   format  : string,  // 'pdf' | 'docx' | 'txt'
 *   mimeType: string,  // the original mimeType passed in
 *   label   : string,  // human-readable name
 * }}
 *
 * @throws {AppError} 400 – mimeType is not a string
 * @throws {AppError} 415 – mimeType is not in the supported set
 */
const detectFileType = (mimeType) => {
  if (!mimeType || typeof mimeType !== 'string') {
    throw AppError.badRequest('processingService.detectFileType: mimeType must be a non-empty string.');
  }

  const entry = FORMAT_REGISTRY[mimeType.trim().toLowerCase()];

  if (!entry) {
    const supported = [...SUPPORTED_MIME_TYPES].join(', ');
    throw new AppError(
      415,
      `Unsupported file type "${mimeType}". Supported types: ${supported}.`
    );
  }

  return {
    format  : entry.format,
    mimeType: mimeType.trim().toLowerCase(),
    label   : entry.label,
  };
};

// ── resolveExtractor ──────────────────────────────────────────────────────────

/**
 * Return the extractor service registered for the given MIME type.
 *
 * Separating this from detectFileType allows callers to get the extractor
 * object without constructing the full type-info object (useful in tests).
 *
 * @param {string} mimeType
 * @returns {object}  The extractor service (has .extractText(filePath) method)
 * @throws  {AppError} 400/415 – same as detectFileType
 */
const resolveExtractor = (mimeType) => {
  // detectFileType validates and throws if unsupported
  detectFileType(mimeType);
  return FORMAT_REGISTRY[mimeType.trim().toLowerCase()].extractor;
};

// ── buildResult ───────────────────────────────────────────────────────────────

/**
 * Normalise raw extractor output into a common result envelope.
 *
 * Each extractor returns a different shape (numPages vs wordCount vs lineCount).
 * This function flattens them into a consistent structure while preserving
 * all format-specific fields in an `details` sub-object.
 *
 * @param {string} format      - 'pdf' | 'docx' | 'txt'
 * @param {string} mimeType
 * @param {string} filePath
 * @param {object} rawResult   - Raw output from extractor.extractText()
 *
 * @returns {{
 *   text       : string,   // Extracted text content
 *   format     : string,   // 'pdf' | 'docx' | 'txt'
 *   mimeType   : string,
 *   fileName   : string,   // basename of the source file
 *   charCount  : number,   // text.length
 *   status     : string,   // always STATUSES.INDEXED at this point
 *   details    : object,   // format-specific fields from the extractor
 * }}
 */
const _buildResult = (format, mimeType, filePath, rawResult) => {
  const { text, ...details } = rawResult;

  return {
    text,
    format,
    mimeType,
    fileName : path.basename(filePath),
    charCount: text.length,
    status   : STATUSES.INDEXED,
    details,
  };
};

// ── processFile ───────────────────────────────────────────────────────────────

/**
 * Run the full detect → route → extract pipeline for a single file.
 *
 * This function is the primary entry point for the processing service.
 * It does NOT touch MongoDB — status persistence is the caller's responsibility.
 *
 * Typical caller pattern (in documentService.processDocumentText):
 *   1. doc.status = STATUSES.PROCESSING  → save
 *   2. result = await processingService.processFile(filePath, doc.fileType)
 *   3. doc.status = result.status        → save   (INDEXED or FAILED)
 *   4. return { document: doc, result }
 *
 * @param {string} filePath  Absolute path to the file on disk
 * @param {string} mimeType  MIME type of the file
 *
 * @returns {Promise<{
 *   text    : string,
 *   format  : string,
 *   mimeType: string,
 *   fileName: string,
 *   charCount: number,
 *   status  : 'indexed',
 *   details : object,
 * }>}
 *
 * @throws {AppError} 400/415 – unsupported MIME type
 * @throws {AppError} 404     – file not found on disk
 * @throws {AppError} 422     – file is corrupt, empty, or has no extractable text
 * @throws {AppError} 500     – unexpected extraction error
 */
const processFile = async (filePath, mimeType) => {
  // ── 1. Detect & validate format ────────────────────────────────────────────
  const { format, label } = detectFileType(mimeType);
  const fileName = path.basename(filePath);

  logger.info(
    `[processingService] Starting extraction | file: ${fileName} | format: ${format} (${label})`
  );

  // ── 2. Resolve the correct extractor ──────────────────────────────────────
  const extractor = FORMAT_REGISTRY[mimeType.trim().toLowerCase()].extractor;

  // ── 3. Run extraction ──────────────────────────────────────────────────────
  let rawResult;
  try {
    rawResult = await extractor.extractText(filePath);
  } catch (err) {
    logger.error(
      `[processingService] Extraction failed | file: ${fileName} | format: ${format} | ${err.message}`
    );
    // Re-throw as-is — format-specific services already produce AppErrors
    throw err;
  }

  // ── 4. Normalise & return ──────────────────────────────────────────────────
  const result = _buildResult(format, mimeType, filePath, rawResult);

  logger.info(
    `[processingService] Extraction complete | file: ${fileName} | ` +
    `chars: ${result.charCount} | format: ${format}`
  );

  return result;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  // Core pipeline
  processFile,

  // Type introspection helpers
  detectFileType,
  resolveExtractor,

  // Constants
  STATUSES,
  SUPPORTED_MIME_TYPES,
};

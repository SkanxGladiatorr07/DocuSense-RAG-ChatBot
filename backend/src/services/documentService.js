/**
 * @file services/documentService.js
 * @description Business-logic layer for document management.
 *
 *   Keeps all MongoDB interactions out of controllers so controllers
 *   stay thin (validate → delegate → respond) and the DB layer remains
 *   independently testable.
 *
 *   Processing delegation
 *   ─────────────────────
 *   Text extraction is fully delegated to processingService.processFile().
 *   This service only manages the MongoDB status lifecycle:
 *     uploaded → processing → indexed
 *                            ↘ failed
 *
 *   Public API
 *   ──────────
 *   createDocument(payload)              → saves a new Document record, returns it
 *   getUserDocuments(userId, options)    → paginated list of a user's documents
 *   getDocumentById(id, uid)            → fetches a single doc owned by the user
 *   processDocumentText(id, uid, dir)   → delegates to processingService, updates DB
 */

const path = require('path');

const { Document }      = require('../models');
const AppError          = require('../utils/AppError');
const logger            = require('../utils/logger');
const processingService = require('./processingService');
const { STATUSES }      = processingService;


// ── createDocument ─────────────────────────────────────────────────────────────

/**
 * Persist a new document record in MongoDB.
 *
 * @param {object} payload
 * @param {string} payload.fileName     - Multer-generated on-disk filename
 * @param {string} payload.originalName - Browser-supplied original filename
 * @param {string} payload.fileType     - MIME type (already validated by upload middleware)
 * @param {number} payload.fileSize     - File size in bytes
 * @param {string} payload.uploadedBy   - User ObjectId (from req.user._id)
 *
 * @returns {Promise<import('mongoose').Document>} The saved Document document
 * @throws  {AppError} 400 if Mongoose validation fails (field-level detail included)
 */
const createDocument = async ({ fileName, originalName, fileType, fileSize, uploadedBy }) => {
  try {
    const doc = await Document.create({
      fileName,
      originalName,
      fileType,
      fileSize,
      uploadedBy,
      // uploadDate and status default from the schema
    });

    return doc;
  } catch (err) {
    // Re-map Mongoose ValidationError to an AppError with field detail so the
    // global error handler surfaces it as a structured 400 rather than a 500.
    if (err.name === 'ValidationError') {
      const fields = Object.fromEntries(
        Object.entries(err.errors).map(([field, e]) => [field, e.message])
      );
      throw AppError.badRequest('Document validation failed.', [fields]);
    }
    throw err; // Any other error propagates unchanged
  }
};

// ── getDocumentById ────────────────────────────────────────────────────────────

/**
 * Fetch a single document by its MongoDB _id, scoped to the requesting user.
 *
 * Scoping to the owner prevents one user from accessing another user's document
 * even if they somehow obtain a valid ObjectId.
 *
 * @param {string} documentId - The document's MongoDB _id
 * @param {string} userId     - The authenticated user's _id (from req.user._id)
 *
 * @returns {Promise<import('mongoose').Document>} The found Document
 * @throws  {AppError} 404 if no document matches both id and owner
 */
const getDocumentById = async (documentId, userId) => {
  const doc = await Document.findOne({ _id: documentId, uploadedBy: userId });

  if (!doc) {
    throw AppError.notFound('Document not found.');
  }

  return doc;
};

// ── getUserDocuments ───────────────────────────────────────────────────────────

/**
 * Return a paginated list of documents owned by a user, sorted newest-first.
 *
 * Pagination uses a simple page/limit model:
 *   page  – 1-based page number (default: 1, min: 1)
 *   limit – results per page   (default: 10, min: 1, max: 100)
 *
 * @param {string} userId            - Authenticated user's ObjectId string
 * @param {object} [options={}]
 * @param {number} [options.page=1]  - Page number (1-based)
 * @param {number} [options.limit=10]- Items per page
 *
 * @returns {Promise<{
 *   documents : import('mongoose').Document[],
 *   total     : number,
 *   page      : number,
 *   limit     : number,
 *   totalPages: number
 * }>}
 * @throws {AppError} 400 for invalid pagination params
 */
const getUserDocuments = async (userId, { page = 1, limit = 10 } = {}) => {
  // ── Sanitise & validate pagination params ──────────────────────────────────
  const parsedPage  = Math.max(1, parseInt(page,  10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  if (isNaN(parsedPage) || isNaN(parsedLimit)) {
    throw AppError.badRequest('Pagination params `page` and `limit` must be positive integers.');
  }

  const skip = (parsedPage - 1) * parsedLimit;

  // ── Run count + find in parallel for efficiency ───────────────────────────
  const [total, documents] = await Promise.all([
    Document.countDocuments({ uploadedBy: userId }),
    Document.find({ uploadedBy: userId })
      .sort({ uploadDate: -1 })     // newest first
      .skip(skip)
      .limit(parsedLimit)
      .lean(),                      // plain JS objects — faster for read-only responses
  ]);

  return {
    documents,
    total,
    page      : parsedPage,
    limit     : parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
  };
};

// ── processDocumentText ────────────────────────────────────────────────────────

/**
 * Orchestrate text extraction for an uploaded document (PDF, DOCX, or TXT),
 * persist the extracted text and status in MongoDB, and return a processing
 * summary ready for the HTTP response.
 *
 * This function owns the DB lifecycle only — all format detection, routing,
 * and extraction is delegated to processingService.processFile().
 *
 * Lifecycle
 * ─────────
 *   1. Fetch & authorise   (getDocumentById — scoped to userId)
 *   2. status → "processing"  (saved so the UI can poll immediately)
 *   3. processingService.processFile(filePath, mimeType)
 *   4a. On success →
 *         doc.extractedText = result.text   (temporary storage)
 *         doc.processedAt   = now
 *         doc.status        = "indexed"
 *         → save, return { document, summary }
 *   4b. On failure →
 *         doc.processingError = err.message
 *         doc.processedAt     = now
 *         doc.status          = "failed"
 *         → save (best-effort), re-throw AppError
 *
 * @param {string} documentId  - The document's MongoDB _id
 * @param {string} userId      - The authenticated user's _id
 * @param {string} uploadsDir  - Absolute path to the uploads directory
 *
 * @returns {Promise<{
 *   document: import('mongoose').Document,
 *   summary : {
 *     documentId  : string,
 *     originalName: string,
 *     format      : string,
 *     mimeType    : string,
 *     status      : 'indexed',
 *     charCount   : number,
 *     processedAt : Date,
 *     details     : object,
 *   }
 * }>}
 *
 * @throws {AppError} 404     – document not found or not owned by this user
 * @throws {AppError} 400/415 – document type has no registered extractor
 * @throws {AppError} 422     – file is corrupt, unreadable, or contains no text
 * @throws {AppError} 500     – unexpected internal error
 */
const processDocumentText = async (documentId, userId, uploadsDir) => {
  // ── 1. Fetch & authorise ──────────────────────────────────────────────────
  const doc = await getDocumentById(documentId, userId);
  const filePath = path.join(uploadsDir, doc.fileName);

  logger.info(
    `[documentService] Processing document ${documentId} ` +
    `(${doc.fileType}) → ${doc.fileName}`
  );

  // ── 2. Mark as processing ────────────────────────────────────────────────
  doc.status          = STATUSES.PROCESSING;
  doc.extractedText   = null;  // clear any previous extraction
  doc.processingError = null;
  await doc.save();

  // ── 3. Delegate to processingService ────────────────────────────────────
  let result;
  try {
    result = await processingService.processFile(filePath, doc.fileType);
  } catch (extractionErr) {
    // ── 4b. Persist failure state & re-throw ─────────────────────────────
    logger.error(
      `[documentService] Extraction failed for ${documentId}: ${extractionErr.message}`
    );
    try {
      doc.status          = STATUSES.FAILED;
      doc.processingError = extractionErr.message;
      doc.processedAt     = new Date();
      await doc.save();
    } catch (saveErr) {
      logger.error(
        `[documentService] Could not persist "failed" status for ${documentId}: ${saveErr.message}`
      );
    }
    throw extractionErr;
  }

  // ── 4a. Persist success state ────────────────────────────────────────────
  const processedAt     = new Date();
  doc.status            = STATUSES.INDEXED;
  doc.extractedText     = result.text;   // stored temporarily for RAG pipeline
  doc.processingError   = null;
  doc.processedAt       = processedAt;
  await doc.save();

  logger.info(
    `[documentService] Document ${documentId} indexed successfully ` +
    `(${result.charCount} chars, format: ${result.format})`
  );

  // ── 5. Build processing summary ──────────────────────────────────────────
  const summary = {
    documentId  : doc._id,
    originalName: doc.originalName,
    format      : result.format,
    mimeType    : result.mimeType,
    status      : doc.status,
    charCount   : result.charCount,
    processedAt,
    details     : result.details,
  };

  return { document: doc, summary };
};

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = { createDocument, getUserDocuments, getDocumentById, processDocumentText };

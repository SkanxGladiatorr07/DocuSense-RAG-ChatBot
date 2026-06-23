/**
 * @file services/documentService.js
 * @description Business-logic layer for document management.
 *
 *   Keeps all MongoDB interactions out of controllers so controllers
 *   stay thin (validate → delegate → respond) and the DB layer remains
 *   independently testable.
 *
 *   Public API
 *   ──────────
 *   createDocument(payload)              → saves a new Document record, returns it
 *   getUserDocuments(userId, options)    → paginated list of a user's documents
 *   getDocumentById(id, uid)            → fetches a single doc owned by the user
 *   processDocumentText(documentId, uid) → extracts PDF text, updates status in DB
 */

const path     = require('path');

const { Document }  = require('../models');
const AppError      = require('../utils/AppError');
const logger        = require('../utils/logger');
const pdfService    = require('./pdfService');

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
 * Extract text from a PDF document and update its status in MongoDB.
 *
 * Lifecycle
 * ─────────
 *   1. Fetch the document record (validates ownership)
 *   2. Guard: only PDFs are supported by this function
 *   3. Transition status → "processing"
 *   4. Delegate to pdfService.extractText()
 *   5a. On success → status "indexed", return extraction result
 *   5b. On failure → status "failed",  re-throw the original error
 *
 * The caller (controller / queue worker) receives:
 *   { document, extraction: { text, numPages, info, metadata } }
 *
 * The document record is always saved with the final status so the DB
 * stays consistent even if the controller crashes after this call returns.
 *
 * @param {string} documentId  - The document's MongoDB _id
 * @param {string} userId      - The authenticated user's _id
 * @param {string} uploadsDir  - Absolute path to the uploads directory
 *
 * @returns {Promise<{
 *   document  : import('mongoose').Document,
 *   extraction: { text: string, numPages: number, info: object, metadata: object }
 * }>}
 *
 * @throws {AppError} 404 – document not found or not owned by this user
 * @throws {AppError} 400 – document is not a PDF
 * @throws {AppError} 422 – PDF is corrupt, password-protected, or has no text
 * @throws {AppError} 500 – unexpected internal error
 */
const processDocumentText = async (documentId, userId, uploadsDir) => {
  // ── 1. Fetch & authorise ────────────────────────────────────────────────────
  const doc = await getDocumentById(documentId, userId);

  // ── 2. Guard: PDF only ──────────────────────────────────────────────────────
  if (doc.fileType !== 'application/pdf') {
    throw AppError.badRequest(
      `processDocumentText only supports PDFs. ` +
      `This document has type "${doc.fileType}".`
    );
  }

  // Resolve the absolute path using the on-disk filename (set by Multer)
  const filePath = path.join(uploadsDir, doc.fileName);

  logger.info(`[documentService] Processing document ${documentId} → ${doc.fileName}`);

  // ── 3. Mark as processing ───────────────────────────────────────────────────
  doc.status = 'processing';
  await doc.save();

  // ── 4. Extract text ─────────────────────────────────────────────────────────
  let extraction;
  try {
    extraction = await pdfService.extractText(filePath);
  } catch (extractionErr) {
    // ── 5b. Mark as failed & re-throw ────────────────────────────────────────
    logger.error(
      `[documentService] Extraction failed for ${documentId}: ${extractionErr.message}`
    );

    try {
      doc.status = 'failed';
      await doc.save();
    } catch (saveErr) {
      // Log but do not swallow the original extraction error
      logger.error(
        `[documentService] Could not persist "failed" status for ${documentId}: ${saveErr.message}`
      );
    }

    throw extractionErr; // Propagate the original AppError to the controller
  }

  // ── 5a. Mark as indexed ─────────────────────────────────────────────────────
  doc.status = 'indexed';
  await doc.save();

  logger.info(
    `[documentService] Document ${documentId} indexed successfully ` +
    `(${extraction.numPages} pages, ${extraction.text.length} chars)`
  );

  return { document: doc, extraction };
};

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = { createDocument, getUserDocuments, getDocumentById, processDocumentText };

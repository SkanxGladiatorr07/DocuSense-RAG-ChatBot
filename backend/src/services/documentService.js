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
 *   createDocument(payload)          → saves a new Document record, returns it
 *   getUserDocuments(userId, options) → paginated list of a user's documents
 *   getDocumentById(id, uid)         → fetches a single doc owned by the user
 */

const { Document } = require('../models');
const AppError     = require('../utils/AppError');

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

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = { createDocument, getUserDocuments, getDocumentById };

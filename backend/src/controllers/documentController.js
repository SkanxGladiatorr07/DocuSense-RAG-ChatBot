/**
 * @file controllers/documentController.js
 * @description Stub handlers for document upload endpoints.
 *
 *   These controllers are intentionally thin for now — they confirm
 *   that the file was accepted by Multer and respond with its metadata.
 *   Full RAG pipeline integration (parsing, chunking, embedding, vector
 *   store upsert) will be added in the next development day.
 */

const asyncHandler   = require('../utils/asyncHandler');
const { successResponse } = require('../utils/ApiResponse');
const AppError       = require('../utils/AppError');

// ── POST /api/v1/documents/upload ─────────────────────────────────────────────

/**
 * Upload a single document.
 *
 * Expects: multipart/form-data with field name "document"
 * The upload middleware (uploadSingle) runs before this handler and
 * populates req.file on success.
 *
 * @route  POST /api/v1/documents/upload
 * @access Private (requires authentication — wire authenticate middleware on route)
 */
const uploadDocument = asyncHandler(async (req, res) => {
  // req.file is populated by Multer if a file was attached
  if (!req.file) {
    throw AppError.badRequest('No file was attached. Please include a document in the request.');
  }

  const { originalname, mimetype, size, filename, path: filePath } = req.file;

  return successResponse(res, 201, 'Document uploaded successfully.', {
    file: {
      originalName: originalname,
      storedName  : filename,
      mimeType    : mimetype,
      sizeBytes   : size,
      path        : filePath,
    },
  });
});

// ── POST /api/v1/documents/upload-many ────────────────────────────────────────

/**
 * Upload multiple documents in a single request.
 *
 * Expects: multipart/form-data with field name "documents" (1–10 files)
 * The upload middleware (uploadArray) runs before this handler and
 * populates req.files on success.
 *
 * @route  POST /api/v1/documents/upload-many
 * @access Private
 */
const uploadDocuments = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw AppError.badRequest('No files were attached. Please include at least one document.');
  }

  const files = req.files.map(({ originalname, mimetype, size, filename, path: filePath }) => ({
    originalName: originalname,
    storedName  : filename,
    mimeType    : mimetype,
    sizeBytes   : size,
    path        : filePath,
  }));

  return successResponse(res, 201, `${files.length} document(s) uploaded successfully.`, { files });
});

module.exports = { uploadDocument, uploadDocuments };

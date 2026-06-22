/**
 * @file controllers/documentController.js
 * @description Request handlers for document upload endpoints.
 *
 *   Layer responsibilities
 *   ──────────────────────
 *   • Validates that req.file exists (Multer populates it after the upload
 *     middleware runs; validation errors from Multer itself are already
 *     converted to AppError by the handleMulterError wrapper).
 *   • Delegates all MongoDB work to documentService.
 *   • Returns a consistent JSON envelope via successResponse.
 *
 *   Routes (mounted at /api/v1/documents)
 *   ──────────────────────────────────────
 *   POST /upload    → uploadDocument
 *   GET  /          → getDocuments
 *   GET  /:id       → getDocument
 */

const asyncHandler      = require('../utils/asyncHandler');
const { successResponse } = require('../utils/ApiResponse');
const AppError          = require('../utils/AppError');
const { documentService } = require('../services');

// ── POST /api/v1/documents/upload ─────────────────────────────────────────────

/**
 * Upload a single document and persist its metadata to MongoDB.
 *
 * Middleware chain (defined in documentRoutes.js):
 *   authenticate  → verifies JWT, attaches req.user
 *   uploadSingle  → runs Multer, populates req.file on success
 *   uploadDocument (this handler)
 *
 * Success response (201):
 * {
 *   "success": true,
 *   "message": "Document uploaded successfully.",
 *   "data": {
 *     "document": {
 *       "_id": "...",
 *       "fileName": "1718000000000-report.pdf",
 *       "originalName": "report.pdf",
 *       "fileType": "application/pdf",
 *       "fileSize": 204800,
 *       "uploadedBy": "64f...",
 *       "uploadDate": "2024-06-10T12:00:00.000Z",
 *       "status": "uploaded",
 *       "createdAt": "...",
 *       "updatedAt": "..."
 *     }
 *   }
 * }
 *
 * @route  POST /api/v1/documents/upload
 * @access Private — requires valid JWT (authenticate middleware)
 */
const uploadDocument = asyncHandler(async (req, res) => {
  // 1. Guard: Multer populates req.file only when a file was successfully
  //    received.  If the request had no file field at all, req.file is
  //    undefined here (Multer won't throw in that case).
  if (!req.file) {
    throw AppError.badRequest(
      'No file was attached. Send the file under the "document" field as multipart/form-data.'
    );
  }

  const { filename, originalname, mimetype, size } = req.file;

  // 2. Persist metadata — service handles DB interaction and validation errors
  const document = await documentService.createDocument({
    fileName    : filename,
    originalName: originalname,
    fileType    : mimetype,
    fileSize    : size,
    uploadedBy  : req.user._id,
  });

  // 3. Respond with the full saved document
  return successResponse(res, 201, 'Document uploaded successfully.', { document });
});

// ── GET /api/v1/documents ───────────────────────────────────────────────────

/**
 * List the authenticated user's documents with pagination.
 *
 * Query parameters:
 *   ?page=<n>   (default: 1)  — which page to return (1-based)
 *   ?limit=<n>  (default: 10) — results per page (max: 100)
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Documents fetched successfully.",
 *   "data": {
 *     "documents" : [...],
 *     "pagination": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
 *   }
 * }
 *
 * @route  GET /api/v1/documents
 * @access Private
 */
const getDocuments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const result = await documentService.getUserDocuments(req.user._id, { page, limit });

  return successResponse(res, 200, 'Documents fetched successfully.', {
    documents : result.documents,
    pagination: {
      total     : result.total,
      page      : result.page,
      limit     : result.limit,
      totalPages: result.totalPages,
    },
  });
});

// ── GET /api/v1/documents/:id ──────────────────────────────────────────────

/**
 * Fetch a single document by ID, scoped to the authenticated user.
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document fetched successfully.",
 *   "data": { "document": { ... } }
 * }
 *
 * Error responses:
 *   400 — :id is not a valid MongoDB ObjectId
 *   404 — document not found or does not belong to this user
 *
 * @route  GET /api/v1/documents/:id
 * @access Private
 */
const getDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: reject obviously malformed ids before hitting the DB
  // (Mongoose CastError is already handled by the global errorHandler,
  //  but an early check gives a clearer message)
  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  const document = await documentService.getDocumentById(id, req.user._id);

  return successResponse(res, 200, 'Document fetched successfully.', { document });
});

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { uploadDocument, getDocuments, getDocument };

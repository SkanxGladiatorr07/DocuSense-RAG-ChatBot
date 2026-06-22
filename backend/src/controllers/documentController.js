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
 *   POST /upload        → uploadDocument
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

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { uploadDocument };

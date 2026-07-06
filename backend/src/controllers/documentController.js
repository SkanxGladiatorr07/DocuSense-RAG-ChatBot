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
 *   GET  /              → getDocuments
 *   GET  /:id           → getDocument
 *   POST /:id/process   → processDocument
 */

const path              = require('path');

const asyncHandler        = require('../utils/asyncHandler');
const { successResponse } = require('../utils/ApiResponse');
const AppError            = require('../utils/AppError');
const { documentService, embeddingPipelineService } = require('../services');

// Absolute path to the uploads directory — mirrors the path used by Multer
// __dirname is backend/src/controllers, so ../../ goes up to backend/
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

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

// ── POST /api/v1/documents/:id/process ────────────────────────────────────────

/**
 * Trigger text extraction for an already-uploaded document (PDF, DOCX, or TXT).
 *
 * The document must exist in MongoDB and be owned by the authenticated user.
 * The appropriate extractor is selected automatically based on the document's
 * stored MIME type — no format hint is needed from the caller.
 *
 * On success, the extracted text is persisted to doc.extractedText (temporary
 * storage for the RAG pipeline) and a concise processing summary is returned.
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document processed successfully.",
 *   "data": {
 *     "document": {
 *       "_id": "...", "status": "indexed",
 *       "extractedText": "Full plain-text content...",
 *       "processedAt": "2024-06-10T12:00:00.000Z", ...
 *     },
 *     "summary": {
 *       "documentId"  : "64f...",
 *       "originalName": "report.pdf",
 *       "format"      : "pdf",
 *       "mimeType"    : "application/pdf",
 *       "status"      : "indexed",
 *       "charCount"   : 4096,
 *       "processedAt" : "2024-06-10T12:00:00.000Z",
 *       "details"     : { "numPages": 5, "info": {...}, "metadata": {} }
 *     }
 *   }
 * }
 *
 * Error responses:
 *   400 — :id malformed, or document type has no registered extractor
 *   404 — document not found or not owned by this user
 *   422 — file is corrupted, unreadable, or contains no text
 *   500 — unexpected extraction error
 *
 * @route  POST /api/v1/documents/:id/process
 * @access Private
 */
const processDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: reject obviously malformed ids before hitting the DB
  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  const { document, summary } = await documentService.processDocumentText(
    id,
    req.user._id,
    UPLOADS_DIR
  );

  return successResponse(res, 200, 'Document processed successfully.', {
    document,
    summary,
  });
});

// ── POST /api/v1/documents/:id/chunk ──────────────────────────────────────────

/**
 * Trigger chunking for an already-processed document.
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document chunked successfully.",
 *   "data": {
 *     "totalChunks": 12,
 *     "avgChunkSize": 498,
 *     "documentId": "64f..."
 *   }
 * }
 *
 * @route  POST /api/v1/documents/:id/chunk
 * @access Private
 */
const chunkDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: reject obviously malformed ids before hitting the DB
  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  const result = await documentService.chunkDocument(id, req.user._id);

  return successResponse(res, 200, 'Document chunked successfully.', result);
});

// ── POST /api/v1/documents/:id/embed ──────────────────────────────────────────

/**
 * Trigger embedding generation for all chunks belonging to a document.
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document embeddings generated successfully.",
 *   "data": {
 *     "documentId": "64f...",
 *     "totalProcessedChunks": 12,
 *     "successfulEmbeddings": 12,
 *     "failedEmbeddings": 0,
 *     "status": "indexed"
 *   }
 * }
 *
 * @route  POST /api/v1/documents/:id/embed
 * @access Private
 */
const embedDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: reject obviously malformed ids before hitting the DB
  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  const result = await embeddingPipelineService.runEmbeddingPipeline(id, req.user._id);

  return successResponse(res, 200, 'Document embeddings generated successfully.', result);
});

// ── GET /api/v1/documents/analytics ───────────────────────────────────────────

/**
 * Retrieve document-specific analytics for the authenticated user.
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document analytics fetched successfully.",
 *   "data": {
 *     "totalDocuments": 5,
 *     "documentsByStatus": { "uploaded": 1, "processing": 0, "indexed": 3, "failed": 1 },
 *     "averageChunksPerDocument": 12.4,
 *     "largestDocument": { ... },
 *     "latestUploadedDocuments": [ ... ]
 *   }
 * }
 *
 * @route  GET /api/v1/documents/analytics
 * @access Private
 */
const getDocumentAnalytics = asyncHandler(async (req, res) => {
  const analytics = await documentService.getDocumentAnalytics(req.user._id);

  return successResponse(res, 200, 'Document analytics fetched successfully.', analytics);
});

// ── DELETE /api/v1/documents/:id ──────────────────────────────────────────────

/**
 * Delete a document from disk, metadata, and chunks/embeddings.
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document deleted successfully.",
 *   "data": {
 *     "summary": {
 *       "documentId": "64f...",
 *       "fileName": "...",
 *       "originalName": "...",
 *       "chunksDeleted": 12,
 *       "fileDeleted": true
 *     }
 *   }
 * }
 *
// ── DELETE /api/v1/documents/:id ──────────────────────────────────────────────

/**
 * Delete any document (admin only).
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document deleted successfully.",
 *   "data": {
 *     "summary": {
 *       "documentId": "64f...",
 *       "fileName": "...",
 *       "originalName": "...",
 *       "chunksDeleted": 12,
 *       "fileDeleted": true
 *     }
 *   }
 * }
 *
 * @route  DELETE /api/v1/documents/:id
 * @access Private (Admin only)
 */
const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: reject obviously malformed ids before hitting DB
  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  // Scope deletion to the authenticated user so they can only delete their own docs
  const summary = await documentService.deleteDocument(id, req.user._id);

  return successResponse(res, 200, 'Document deleted successfully.', { summary });
});

// ── POST /api/v1/documents/:id/reprocess ──────────────────────────────────────

/**
 * Reprocess any document: re-extract, chunk, and embed (admin only).
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "message": "Document reprocessed successfully.",
 *   "data": {
 *     "documentId": "64f...",
 *     "extractionSummary": { ... },
 *     "chunkingSummary": { "totalChunks": 12, "avgChunkSize": 498 },
 *     "embeddingSummary": { "totalProcessedChunks": 12, "successfulEmbeddings": 12, "failedEmbeddings": 0 },
 *     "status": "indexed"
 *   }
 * }
 *
 * @route  POST /api/v1/documents/:id/reprocess
 * @access Private (Admin only)
 */
const reprocessDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: reject obviously malformed ids before hitting DB
  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  // Admin bypass: pass null for userId to reprocess any document
  const result = await documentService.reprocessDocument(id, null);

  return successResponse(res, 200, 'Document reprocessed successfully.', result);
});

// ── POST /api/v1/documents/bulk ───────────────────────────────────────────────

/**
 * Perform bulk operations (delete or reprocess) on documents (admin only).
 *
 * Request body:
 * {
 *   "action": "delete" | "reprocess",
 *   "documentIds": ["64f...", "64f..."]
 * }
 *
 * @route  POST /api/v1/documents/bulk
 * @access Private (Admin only)
 */
const bulkDocuments = asyncHandler(async (req, res) => {
  const { action, documentIds } = req.body;

  if (!action || !['delete', 'reprocess'].includes(action)) {
    throw AppError.badRequest('"action" must be either "delete" or "reprocess".');
  }

  if (!documentIds || !Array.isArray(documentIds)) {
    throw AppError.badRequest('Request body must include a "documentIds" array.');
  }

  let result;
  if (action === 'delete') {
    // Admin bypass: pass null for userId
    result = await documentService.bulkDeleteDocuments(documentIds, null);
  } else {
    // Admin bypass: pass null for userId
    result = await documentService.bulkReprocessDocuments(documentIds, null);
  }

  return successResponse(res, 200, `Bulk document ${action} complete.`, result);
});

// ── GET /api/v1/documents/:id/insights ─────────────────────────────────────────

/**
 * Fetch insights (summary, detailedSummary, keyTopics, importantPoints, keyDates, keywords, questions)
 * for a specific document.
 *
 * @route  GET /api/v1/documents/:id/insights
 * @access Private
 */
const getDocumentInsights = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id.match(/^[a-f\d]{24}$/i)) {
    throw AppError.badRequest(`"${id}" is not a valid document ID.`);
  }

  const document = await documentService.getDocumentById(id, req.user._id);

  // If insights do not exist yet and document is indexed, generate them now
  if (!document.insightsGeneratedAt && document.status === 'indexed') {
    const { insightsService } = require('../services');
    const generated = await insightsService.generateInsights(id, req.user._id);
    return successResponse(res, 200, 'Document insights fetched successfully.', generated);
  }

  return successResponse(res, 200, 'Document insights fetched successfully.', {
    summary           : document.summary,
    detailedSummary   : document.detailedSummary,
    keyTopics         : document.keyTopics || [],
    importantPoints   : document.importantPoints || [],
    importantDates     : document.importantDates || [],
    keywords          : document.keywords || [],
    suggestedQuestions: document.suggestedQuestions || [],
  });
});

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  uploadDocument,
  getDocuments,
  getDocument,
  processDocument,
  chunkDocument,
  embedDocument,
  getDocumentAnalytics,
  deleteDocument,
  reprocessDocument,
  bulkDocuments,
  getDocumentInsights,
};

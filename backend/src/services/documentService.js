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
const fs = require('fs').promises;
const mongoose = require('mongoose');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const { Document, Chunk } = require('../models');
const AppError          = require('../utils/AppError');
const logger            = require('../utils/logger');
const processingService = require('./processingService');
const chunkingService   = require('./chunkingService');
const chunkStorageService = require('./chunkStorageService');
const embeddingPipelineService = require('./embeddingPipelineService');
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

// ── chunkDocument ─────────────────────────────────────────────────────────────

/**
 * Chunk a document's extracted text and save the resulting chunks to MongoDB.
 *
 * @param {string} documentId - The document ID
 * @param {string} userId - The authenticated user ID (for authorization checking)
 * @returns {Promise<{ totalChunks: number, avgChunkSize: number, documentId: string }>}
 * @throws {AppError} 404 - Document not found or not owned by user
 * @throws {AppError} 400/422 - Document has not been processed/extracted yet, or text is empty
 */
const chunkDocument = async (documentId, userId) => {
  // 1. Fetch document and verify ownership
  const doc = await getDocumentById(documentId, userId);

  // 2. Guard: verify document has been processed/has extracted text
  if (!doc.extractedText) {
    throw AppError.unprocessable(
      'Document cannot be chunked because it has no extracted text. Please process the document first.'
    );
  }

  // 3. Generate Chunks
  const chunks = chunkingService.chunkText(doc.extractedText);

  if (chunks.length === 0) {
    throw AppError.unprocessable(
      'Document text resulted in 0 chunks. The extracted text might be empty or invalid.'
    );
  }

  // 4. Save Chunks to MongoDB — include provenance snapshot for citation support
  await chunkStorageService.storeChunks(documentId, chunks, {
    sourceDocumentName: doc.originalName   ?? null,
    uploadedAt        : doc.uploadDate     ?? null,
  });

  // 5. Calculate average chunk size (words)
  const totalChunks = chunks.length;
  const totalWords = chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
  const avgChunkSize = Math.round(totalWords / totalChunks);

  return {
    totalChunks,
    avgChunkSize,
    documentId: doc._id,
  };
};

// ── getDocumentAnalytics ───────────────────────────────────────────────────────

/**
 * Compute document-specific analytics. Run globally if userId is omitted or null,
 * or scoped to the user if userId is provided.
 *
 * @param {string} [userId=null] - Optional authenticated user's ID
 * @returns {Promise<{
 *   totalDocuments: number,
 *   documentsByStatus: Record<string, number>,
 *   averageChunksPerDocument: number,
 *   largestDocument: object|null,
 *   latestUploadedDocuments: object[]
 * }>}
 */
const getDocumentAnalytics = async (userId = null) => {
  const matchQuery = {};

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('documentService.getDocumentAnalytics: invalid userId format.');
    }
    matchQuery.uploadedBy = new mongoose.Types.ObjectId(userId);
  }

  try {
    const [
      totalDocs,
      statusCounts,
      avgChunksData,
      largestDoc,
      latestDocs
    ] = await Promise.all([
      // 1. Total uploaded documents
      Document.countDocuments(matchQuery),

      // 2. Documents by status (Mongoose aggregation)
      Document.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // 3. Average chunks per document (Mongoose aggregation with $lookup)
      Document.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'chunks',
            localField: '_id',
            foreignField: 'documentId',
            as: 'chunks'
          }
        },
        {
          $group: {
            _id: null,
            totalDocs: { $sum: 1 },
            totalChunks: { $sum: { $size: '$chunks' } }
          }
        },
        {
          $project: {
            avgChunks: {
              $cond: [
                { $eq: ['$totalDocs', 0] },
                0,
                { $divide: ['$totalChunks', '$totalDocs'] }
              ]
            }
          }
        }
      ]),

      // 4. Largest document (by fileSize)
      Document.findOne(matchQuery)
        .sort({ fileSize: -1 })
        .select('_id fileName originalName fileType fileSize uploadDate status')
        .lean(),

      // 5. Latest uploaded documents (limit to 5)
      Document.find(matchQuery)
        .sort({ uploadDate: -1 })
        .limit(5)
        .select('_id fileName originalName fileType fileSize uploadDate status')
        .lean()
    ]);

    // Format documents by status count mapping
    const docStatuses = ['uploaded', 'processing', 'indexed', 'failed'];
    const byStatus = Object.fromEntries(docStatuses.map(s => [s, 0]));
    
    statusCounts.forEach(bucket => {
      const status = bucket._id;
      if (status) {
        byStatus[status] = bucket.count;
      }
    });

    const averageChunks = avgChunksData.length > 0 ? parseFloat(avgChunksData[0].avgChunks.toFixed(2)) : 0;

    return {
      totalDocuments: totalDocs,
      documentsByStatus: byStatus,
      averageChunksPerDocument: averageChunks,
      largestDocument: largestDoc || null,
      latestUploadedDocuments: latestDocs
    };

  } catch (err) {
    logger.error(`[documentService.getDocumentAnalytics] Failed to compute doc analytics: ${err.message}`);
    throw AppError.internal('Failed to retrieve document analytics.');
  }
};

// ── deleteDocument ─────────────────────────────────────────────────────────────

/**
 * Delete a document from disk, remove its database metadata, and clean up
 * all associated text chunks/embeddings.
 *
 * Scoped to the authenticated owner to prevent unauthorised deletions.
 *
 * @param {string} documentId - MongoDB ObjectId string of the document
 * @param {string} userId     - MongoDB ObjectId string of the authenticated user
 *
 * @returns {Promise<{
 *   documentId: string,
 *   fileName: string,
 *   originalName: string,
 *   chunksDeleted: number,
 *   fileDeleted: boolean
 * }>}
 * @throws {AppError} 404 if the document is not found or not owned by user
 * @throws {AppError} 500 on unexpected deletion failure
 */
const deleteDocument = async (documentId, userId) => {
  // 1. Fetch document and verify ownership (throws 404 if not found/owned)
  const doc = await getDocumentById(documentId, userId);

  // 2. Delete file from disk
  const filePath = path.join(UPLOADS_DIR, doc.fileName);
  let fileDeleted = false;
  try {
    await fs.unlink(filePath);
    fileDeleted = true;
    logger.info(`[documentService.deleteDocument] Successfully deleted file from disk: ${filePath}`);
  } catch (fileErr) {
    // If file is not on disk (ENOENT), log warning but proceed so database stays consistent
    if (fileErr.code === 'ENOENT') {
      logger.warn(`[documentService.deleteDocument] File not found on disk during deletion: ${filePath}. Proceeding to database clean-up.`);
    } else {
      logger.error(`[documentService.deleteDocument] Failed to delete file from disk: ${fileErr.message}`);
      throw AppError.internal('Failed to delete document file from disk.');
    }
  }

  // 3. Delete associated chunks & embeddings
  let chunksDeleted = 0;
  try {
    chunksDeleted = await chunkStorageService.deleteChunksByDocumentId(documentId);
    logger.info(`[documentService.deleteDocument] Deleted ${chunksDeleted} chunks for document: ${documentId}`);
  } catch (chunkErr) {
    logger.error(`[documentService.deleteDocument] Failed to delete chunks: ${chunkErr.message}`);
    throw AppError.internal('Failed to delete document chunks from database.');
  }

  // 4. Delete document metadata
  try {
    await Document.deleteOne({ _id: documentId, uploadedBy: userId });
    logger.info(`[documentService.deleteDocument] Deleted document metadata for: ${documentId}`);
  } catch (dbErr) {
    logger.error(`[documentService.deleteDocument] Failed to delete document metadata: ${dbErr.message}`);
    throw AppError.internal('Failed to delete document metadata from database.');
  }

  return {
    documentId: documentId.toString(),
    fileName: doc.fileName,
    originalName: doc.originalName,
    chunksDeleted,
    fileDeleted
  };
};

// ── reprocessDocument ──────────────────────────────────────────────────────────

/**
 * Reprocess an already uploaded document:
 *   1. Re-extract document text.
 *   2. Regenerate chunks (which deletes previous chunks).
 *   3. Regenerate embeddings (which generates new vector embeddings).
 *
 * Runs sequentially and returns a combined summary.
 *
 * @param {string} documentId - MongoDB ObjectId of the document to reprocess.
 * @param {string} userId     - Authenticated user ObjectId.
 * @returns {Promise<{
 *   documentId: string,
 *   extractionSummary: object,
 *   chunkingSummary: object,
 *   embeddingSummary: object,
 *   status: string
 * }>}
 * @throws {AppError} 404 - Document not found or not owned by user.
 * @throws {AppError} 500 - Reprocessing pipeline failure.
 */
const reprocessDocument = async (documentId, userId) => {
  logger.info(`[documentService.reprocessDocument] Reprocessing started for document: ${documentId}`);

  // 1. Fetch document and verify ownership first
  const doc = await getDocumentById(documentId, userId);

  // 2. Re-extract text (resets status to processing, extracts, and saves as indexed)
  const processResult = await processDocumentText(documentId, userId, UPLOADS_DIR);

  // 3. Regenerate chunks (deletes previous chunks and creates new ones)
  const chunkResult = await chunkDocument(documentId, userId);

  // 4. Regenerate embeddings (sets status to processing, generates vectors, and saves as indexed)
  const embedResult = await embeddingPipelineService.runEmbeddingPipeline(documentId, userId);

  logger.info(`[documentService.reprocessDocument] Reprocessing completed successfully for document: ${documentId}`);

  return {
    documentId: documentId.toString(),
    extractionSummary: processResult.summary,
    chunkingSummary: {
      totalChunks: chunkResult.totalChunks,
      avgChunkSize: chunkResult.avgChunkSize
    },
    embeddingSummary: {
      totalProcessedChunks: embedResult.totalProcessedChunks,
      successfulEmbeddings: embedResult.successfulEmbeddings,
      failedEmbeddings: embedResult.failedEmbeddings
    },
    status: embedResult.status
  };
};

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  createDocument,
  getUserDocuments,
  getDocumentById,
  processDocumentText,
  chunkDocument,
  getDocumentAnalytics,
  deleteDocument,
  reprocessDocument,
};

/**
 * @file services/chunkStorageService.js
 * @description Service to manage persistence of document text chunks in MongoDB.
 *
 *   Provides functions to save chunk collections, retrieve them, and clean them up.
 *   Enforces uniqueness and prevents duplicate chunks.
 */

const mongoose = require('mongoose');
const { Chunk } = require('../models');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Persist an array of chunks to the database for a specific document.
 * To prevent duplicate chunk creation, any existing chunks for this document
 * are deleted before saving the new ones (ensuring idempotent reprocessing).
 *
 * @param {string|mongoose.Types.ObjectId} documentId - The target document ID
 * @param {Array<{ chunkIndex: number, content: string, wordCount: number, metadata?: object, embedding?: number[] }>} chunks
 * @param {object} [documentMeta={}] - Optional source provenance snapshot.
 * @param {string} [documentMeta.sourceDocumentName] - Document.originalName at chunk time.
 * @param {Date}   [documentMeta.uploadedAt]          - Document.uploadDate at chunk time.
 * @returns {Promise<import('mongoose').Document[]>} The newly inserted Chunk documents
 * @throws {AppError} 400 - If parameters are invalid or MongoDB validation fails
 */
const storeChunks = async (documentId, chunks, documentMeta = {}) => {
  // ── 1. Validate Inputs ─────────────────────────────────────────────────────
  if (!documentId) {
    throw AppError.badRequest('chunkStorageService.storeChunks: documentId is required.');
  }

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    throw AppError.badRequest('chunkStorageService.storeChunks: invalid documentId format.');
  }

  if (!Array.isArray(chunks)) {
    throw AppError.badRequest('chunkStorageService.storeChunks: chunks must be an array.');
  }

  logger.info(`[chunkStorageService] Storing ${chunks.length} chunks for document: ${documentId}`);

  // If no chunks generated (e.g. empty file), simply return empty array
  if (chunks.length === 0) {
    return [];
  }

  // ── 2. Enforce Uniqueness (Prevent Duplicates) ─────────────────────────────
  // Delete any existing chunks for this document before inserting the new ones.
  // This allows safe reprocessing without triggering unique key constraint errors on (documentId, chunkIndex).
  try {
    const deleteResult = await Chunk.deleteMany({ documentId });
    if (deleteResult.deletedCount > 0) {
      logger.info(`[chunkStorageService] Deleted ${deleteResult.deletedCount} existing chunks for document: ${documentId} to prevent duplicates.`);
    }
  } catch (deleteErr) {
    logger.error(`[chunkStorageService] Error cleaning up old chunks: ${deleteErr.message}`);
    throw AppError.internal('Failed to clear existing chunks before storing new ones.');
  }

  // ── 3. Prepare documents for insertion ─────────────────────────────────────
  const chunkDocs = chunks.map((chunk) => {
    // Validate individual chunk fields
    if (typeof chunk.chunkIndex !== 'number' || chunk.chunkIndex < 0) {
      throw AppError.badRequest(`Invalid chunkIndex in chunk payload: ${JSON.stringify(chunk)}`);
    }
    if (!chunk.content || typeof chunk.content !== 'string') {
      throw AppError.badRequest(`Invalid content in chunk payload: ${JSON.stringify(chunk)}`);
    }
    if (typeof chunk.wordCount !== 'number' || chunk.wordCount < 0) {
      throw AppError.badRequest(`Invalid wordCount in chunk payload: ${JSON.stringify(chunk)}`);
    }

    return {
      documentId,
      chunkIndex : chunk.chunkIndex,
      content    : chunk.content,
      wordCount  : chunk.wordCount,
      metadata   : chunk.metadata || {},
      embedding  : Array.isArray(chunk.embedding) ? chunk.embedding : undefined,
      // ── Source provenance (from documentMeta — null-safe for old callers) ──
      sourceDocumentName: documentMeta.sourceDocumentName ?? null,
      uploadedAt        : documentMeta.uploadedAt         ?? null,
      // pageNumber: pull from chunk.metadata.pageNumber if the extractor set it,
      // or from chunk.pageNumber if the chunking layer passes it explicitly.
      pageNumber: chunk.pageNumber ?? chunk.metadata?.pageNumber ?? null,
    };
  });

  // ── 4. Bulk Insert ─────────────────────────────────────────────────────────
  try {
    const savedChunks = await Chunk.insertMany(chunkDocs);
    logger.info(`[chunkStorageService] Successfully stored ${savedChunks.length} chunks for document: ${documentId}`);
    return savedChunks;
  } catch (insertErr) {
    logger.error(`[chunkStorageService] Bulk insert failed: ${insertErr.message}`);
    
    // Check for Mongoose ValidationError
    if (insertErr.name === 'ValidationError') {
      const fields = Object.fromEntries(
        Object.entries(insertErr.errors).map(([field, e]) => [field, e.message])
      );
      throw AppError.badRequest('Chunk validation failed.', [fields]);
    }
    
    // Check for MongoDB duplicate key error (if concurrent requests bypassed deleteMany)
    if (insertErr.code === 11000) {
      throw AppError.badRequest('Duplicate chunk indexes detected for this document.');
    }
    
    throw AppError.internal('Failed to save document chunks to database.');
  }
};

/**
 * Retrieve all chunks associated with a specific document, ordered by chunkIndex.
 *
 * @param {string|mongoose.Types.ObjectId} documentId
 * @returns {Promise<import('mongoose').Document[]>} Ordered list of Chunk documents
 */
const getChunksByDocumentId = async (documentId) => {
  if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
    throw AppError.badRequest('chunkStorageService.getChunksByDocumentId: invalid or missing documentId.');
  }

  return Chunk.find({ documentId }).sort({ chunkIndex: 1 }).lean();
};

/**
 * Delete all chunks associated with a document.
 *
 * @param {string|mongoose.Types.ObjectId} documentId
 * @returns {Promise<number>} Number of deleted chunks
 */
const deleteChunksByDocumentId = async (documentId) => {
  if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
    throw AppError.badRequest('chunkStorageService.deleteChunksByDocumentId: invalid or missing documentId.');
  }

  const result = await Chunk.deleteMany({ documentId });
  return result.deletedCount;
};

module.exports = {
  storeChunks,
  getChunksByDocumentId,
  deleteChunksByDocumentId,
};

/**
 * @file services/embeddingPipelineService.js
 * @description Ingestion pipeline stage to generate vector embeddings for all document chunks.
 */

const { Chunk, Document } = require('../models');
const { generateEmbeddingsBatch } = require('./embeddingService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { STATUSES } = require('./processingService');

/**
 * Executes the embedding generation pipeline for a specific document.
 *
 * Flow:
 *   1. Fetch the document and verify owner.
 *   2. Transition document status to "processing".
 *   3. Retrieve all text chunks associated with this document.
 *   4. For each chunk:
 *      - Skip if it already has a non-empty embedding array.
 *      - Otherwise, request embedding vector from Gemini embedding API.
 *      - Update the chunk in the database with the generated vector.
 *   5. Transition document status to "indexed" upon successful completion.
 *   6. On failure, transition document status to "failed" and record the error.
 *
 * @param {string} documentId - Mongoose ObjectId of the document to embed.
 * @param {string} userId - Authenticated user ObjectId (for security checking).
 * @returns {Promise<{
 *   documentId: string,
 *   totalChunks: number,
 *   embeddedCount: number,
 *   skippedCount: number,
 *   status: string
 * }>} Summary of the pipeline execution.
 * @throws {AppError} 404 - Document not found or not owned by user.
 * @throws {AppError} 422 - Document has no chunks to embed.
 */
const runEmbeddingPipeline = async (documentId, userId = null) => {
  // ── 1. Fetch & authorize document ──────────────────────────────────────────
  const query = userId ? { _id: documentId, uploadedBy: userId } : { _id: documentId };
  const doc = await Document.findOne(query);
  if (!doc) {
    throw AppError.notFound('Document not found or unauthorized.');
  }

  logger.info(`[embeddingPipeline] Starting embedding pipeline for document: ${documentId} (${doc.originalName})`);

  // ── 2. Transition status to processing ─────────────────────────────────────
  doc.status = STATUSES.PROCESSING;
  doc.processingError = null;
  await doc.save();

  let chunks = [];
  try {
    // ── 3. Retrieve chunks ───────────────────────────────────────────────────
    chunks = await Chunk.find({ documentId }).sort({ chunkIndex: 1 });

    if (chunks.length === 0) {
      throw AppError.unprocessable(
        'Cannot generate embeddings because this document has not been chunked yet. ' +
        'Please run the chunking endpoint first.'
      );
    }

    let successfulEmbeddings = 0;
    let failedEmbeddings = 0;
    let skippedCount = 0;

    // ── 4. Generate & save embeddings ────────────────────────────────────────
    // ── 4. Generate & save embeddings in batches of 100 ──────────────────────
    const BATCH_SIZE = 100;
    const chunksToEmbed = chunks.filter(c => !(Array.isArray(c.embedding) && c.embedding.length > 0));
    skippedCount = chunks.length - chunksToEmbed.length;

    for (let i = 0; i < chunksToEmbed.length; i += BATCH_SIZE) {
      const batch = chunksToEmbed.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.content);

      try {
        const vectors = await generateEmbeddingsBatch(texts);
        
        // Save the generated vectors back to the database
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = vectors[j];
          await batch[j].save();
          successfulEmbeddings++;
        }
      } catch (batchErr) {
        logger.error(`[embeddingPipeline] Failed to embed batch starting at index ${i}: ${batchErr.message}`);
        failedEmbeddings += batch.length;
      }
    }

    // ── 5. Transition status on completion ───────────────────────────────────
    doc.processedAt = new Date();
    if (failedEmbeddings > 0) {
      doc.status = STATUSES.FAILED;
      doc.processingError = `Failed to generate embeddings for ${failedEmbeddings} out of ${chunks.length} chunks.`;
    } else {
      doc.status = STATUSES.INDEXED;
      doc.processingError = null;
    }
    await doc.save();

    logger.info(
      `[embeddingPipeline] Pipeline completed for document: ${documentId} | ` +
      `Total: ${chunks.length} | Success: ${successfulEmbeddings} | Skipped: ${skippedCount} | Failed: ${failedEmbeddings} | Status: ${doc.status}`
    );

    return {
      documentId: doc._id,
      totalProcessedChunks: chunks.length,
      successfulEmbeddings,
      skippedCount,
      failedEmbeddings,
      status: doc.status,
    };

  } catch (pipelineErr) {
    // ── 6. Handle errors gracefully & update status ──────────────────────────
    logger.error(`[embeddingPipeline] Pipeline failed for document ${documentId}: ${pipelineErr.message}`);
    
    try {
      doc.status = STATUSES.FAILED;
      doc.processingError = pipelineErr.message;
      doc.processedAt = new Date();
      await doc.save();
    } catch (saveErr) {
      logger.error(`[embeddingPipeline] Failed to save error status: ${saveErr.message}`);
    }

    // Propagate original error if it is an AppError, otherwise wrap it
    if (pipelineErr instanceof AppError) {
      throw pipelineErr;
    }
    throw AppError.internal(`Embedding pipeline failed: ${pipelineErr.message}`);
  }
};

module.exports = {
  runEmbeddingPipeline,
};

/**
 * @file models/Chunk.js
 * @description Mongoose schema and model for document text chunks.
 *
 *   Stores processed slices/chunks of document text to be used in
 *   vector search and context generation for the RAG pipeline.
 *   Designed to be flexible for future vector embedding integration.
 */

const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema(
  {
    /** Reference to the parent Document. */
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'documentId is required'],
      index: true,
    },

    /** The sequence index of this chunk within the parent document (0-based). */
    chunkIndex: {
      type: Number,
      required: [true, 'chunkIndex is required'],
      min: [0, 'chunkIndex must be at least 0'],
    },

    /** The actual text content of the chunk. */
    content: {
      type: String,
      required: [true, 'content is required'],
      trim: true,
    },

    /** Approximate word count of the chunk content. */
    wordCount: {
      type: Number,
      required: [true, 'wordCount is required'],
      min: [0, 'wordCount must be at least 0'],
    },

    /**
     * Flexible metadata object for context, formatting, page numbers,
     * section headers, or pipeline run metadata.
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /**
     * Placeholder field for vector embeddings (e.g. OpenAI text-embedding-3-small).
     * Type is defined as [Number] (array of floats).
     * Marked as optional to keep the schema flexible.
     */
    embedding: {
      type: [Number],
      default: undefined,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Compound index to ensure quick retrieval of ordered chunks of a document,
// and enforce uniqueness to prevent duplicate chunks for the same index.
chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

const Chunk = mongoose.model('Chunk', chunkSchema);

module.exports = Chunk;

/**
 * @file models/Document.js
 * @description Mongoose schema and model for uploaded documents.
 *
 *   Tracks everything the RAG pipeline needs to know about a file:
 *   where it lives on disk, who uploaded it, what type it is,
 *   which stage of processing it has reached, and the extracted text
 *   content held temporarily until the vector-embedding stage consumes it.
 *
 *   Status lifecycle:
 *     uploaded → processing → indexed
 *                           ↘ failed
 */

const mongoose = require('mongoose');

// ── Schema ────────────────────────────────────────────────────────────────────

const documentSchema = new mongoose.Schema(
  {
    // ── File identity ─────────────────────────────────────────────────────────

    /** Multer-generated filename on disk (e.g. "1718000000000-report.pdf"). */
    fileName: {
      type    : String,
      required: [true, 'fileName is required'],
      trim    : true,
    },

    /** Original filename as provided by the user's browser/client. */
    originalName: {
      type    : String,
      required: [true, 'originalName is required'],
      trim    : true,
    },

    // ── File metadata ─────────────────────────────────────────────────────────

    /**
     * MIME type of the uploaded file.
     * Restricted to the three types the upload middleware accepts.
     */
    fileType: {
      type    : String,
      required: [true, 'fileType is required'],
      enum    : {
        values: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        message: 'fileType must be one of: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain',
      },
    },

    /** File size in bytes. Must be > 0 and ≤ 10 MB. */
    fileSize: {
      type    : Number,
      required: [true, 'fileSize is required'],
      min     : [1, 'fileSize must be at least 1 byte'],
      max     : [50 * 1024 * 1024, 'fileSize cannot exceed 50 MB (52,428,800 bytes)'],
    },

    // ── Ownership ─────────────────────────────────────────────────────────────

    /** Reference to the User who uploaded this document. */
    uploadedBy: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'User',
      required: [true, 'uploadedBy is required'],
      index   : true,   // fast look-up of all docs for a given user
    },

    /** Explicit upload timestamp (separate from Mongoose's createdAt). */
    uploadDate: {
      type   : Date,
      default: Date.now,
    },

    // ── Processing status ─────────────────────────────────────────────────────

    /**
     * Tracks where this document is in the RAG ingestion pipeline:
     *
     *   uploaded   → file saved to disk, not yet processed
     *   processing → text extraction / chunking / embedding in progress
     *   indexed    → vectors stored in the vector store; ready for queries
     *   failed     → pipeline encountered an unrecoverable error
     */
    status: {
      type   : String,
      enum   : {
        values : ['uploaded', 'processing', 'indexed', 'failed'],
        message: 'status must be one of: uploaded, processing, indexed, failed',
      },
      default: 'uploaded',
      index  : true,   // fast look-up of docs by status (e.g. all "failed")
    },
    // ── Processing output ──────────────────────────────────────────────────────

    /**
     * Extracted plain-text content from the document.
     *
     * Populated by processingService after successful extraction.
     * Held here temporarily until the embedding / chunking stage reads it.
     * Not indexed — can be large (up to ~5 MB of text for a 10 MB PDF).
     */
    extractedText: {
      type   : String,
      default: null,
    },

    /**
     * Human-readable error message captured when status transitions to
     * "failed".  Lets the UI surface a meaningful reason without exposing
     * stack traces.
     */
    processingError: {
      type   : String,
      default: null,
    },

    /**
     * Timestamp set when processing completes (success or failure).
     * Useful for auditing and detecting stale "processing" documents.
     */
    processedAt: {
      type   : Date,
      default: null,
    },

    // ── Document Insights ─────────────────────────────────────────────────────

    /** A short 4-5 sentence summary of the document. */
    summary: {
      type   : String,
      default: null,
    },

    /** A detailed, comprehensive summary of the document. */
    detailedSummary: {
      type   : String,
      default: null,
    },

    /** Key topics discussed in the document. */
    keyTopics: {
      type   : [String],
      default: [],
    },

    /** Important policies, rules, or points from the document. */
    importantPoints: {
      type   : [String],
      default: [],
    },

    /** Key dates found within the document. */
    importantDates: {
      type   : [String],
      default: [],
    },

    /** Keywords extracted from the document. */
    keywords: {
      type   : [String],
      default: [],
    },

    /** AI-suggested natural language questions about the document. */
    suggestedQuestions: {
      type   : [String],
      default: [],
    },

    /** Timestamp of when the document insights were generated. */
    insightsGeneratedAt: {
      type   : Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Compound index: retrieve all documents for a user sorted by upload date
documentSchema.index({ uploadedBy: 1, uploadDate: -1 });

// ── Model ─────────────────────────────────────────────────────────────────────

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;

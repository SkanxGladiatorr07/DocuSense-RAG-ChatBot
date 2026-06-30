/**
 * @file models/Chunk.js
 * @description Mongoose schema and model for document text chunks.
 *
 *   Stores processed slices/chunks of document text to be used in
 *   vector search and context generation for the RAG pipeline.
 *
 *   Backward compatibility
 *   ──────────────────────
 *   All fields added after the initial schema (sourceDocumentName,
 *   pageNumber, uploadedAt) are optional with null/undefined defaults.
 *   Existing Chunk documents that predate these fields will load and
 *   validate without errors; new fields will simply be null on those records.
 *
 *   Field overview
 *   ──────────────
 *   Core (original)
 *     documentId          – ref to parent Document
 *     chunkIndex          – 0-based position within the document
 *     content             – raw text of the chunk
 *     wordCount           – approximate word count
 *     metadata            – open Mixed bag (page hints, section headers, …)
 *     embedding           – float vector for similarity search
 *
 *   Source provenance (added for citation support)
 *     sourceDocumentName  – snapshot of Document.originalName at chunk time
 *     pageNumber          – page hint extracted from the source (null if N/A)
 *     uploadedAt          – snapshot of Document.uploadDate at chunk time
 */

const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema(
  {
    // ── Core fields (original) ─────────────────────────────────────────────────

    /** Reference to the parent Document. */
    documentId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Document',
      required: [true, 'documentId is required'],
      index   : true,
    },

    /** The sequence index of this chunk within the parent document (0-based). */
    chunkIndex: {
      type    : Number,
      required: [true, 'chunkIndex is required'],
      min     : [0, 'chunkIndex must be at least 0'],
    },

    /** The actual text content of the chunk. */
    content: {
      type    : String,
      required: [true, 'content is required'],
      trim    : true,
    },

    /** Approximate word count of the chunk content. */
    wordCount: {
      type    : Number,
      required: [true, 'wordCount is required'],
      min     : [0, 'wordCount must be at least 0'],
    },

    /**
     * Flexible metadata object for context, formatting, and pipeline run data.
     * Preserved for backward compatibility — new dedicated fields below are
     * preferred for structured data going forward.
     */
    metadata: {
      type   : mongoose.Schema.Types.Mixed,
      default: {},
    },

    /**
     * Vector embedding for semantic similarity search.
     * Type [Number] (array of floats).  Optional — undefined until the embed
     * pipeline runs.
     */
    embedding: {
      type   : [Number],
      default: undefined,
    },

    // ── Source provenance fields (added for citation support) ──────────────────
    //
    //   All fields below default to null so existing chunk documents that
    //   predate this schema version continue to load without validation errors.
    //   New chunks created after this change will populate these fields from
    //   the parent Document at chunking time.

    /**
     * Snapshot of Document.originalName at the time this chunk was created.
     * Denormalised so citation data survives document rename or deletion.
     * Null for chunks created before this field was introduced.
     */
    sourceDocumentName: {
      type   : String,
      trim   : true,
      default: null,
    },

    /**
     * Page number from which this chunk was extracted, if determinable.
     *
     * Populated by:
     *   • PDF extractor  — page number from pdf-parse metadata
     *   • DOCX extractor — null (Word documents have no reliable page map)
     *   • TXT extractor  — null (plain text has no page concept)
     *
     * Null means "page not available or not applicable", not "page 0".
     */
    pageNumber: {
      type   : Number,
      min    : [1, 'pageNumber must be at least 1'],
      default: null,
    },

    /**
     * Snapshot of Document.uploadDate at the time this chunk was created.
     * Denormalised for the same reason as sourceDocumentName — citations
     * remain accurate even if the Document record is later modified.
     * Null for chunks created before this field was introduced.
     */
    uploadedAt: {
      type   : Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/**
 * Primary index: fast ordered retrieval of all chunks for a document.
 * Unique constraint prevents duplicate chunk positions (guards against
 * concurrent re-chunking requests).
 */
chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

// ── Model ─────────────────────────────────────────────────────────────────────

const Chunk = mongoose.model('Chunk', chunkSchema);

module.exports = Chunk;


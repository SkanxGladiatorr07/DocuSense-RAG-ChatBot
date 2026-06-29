/**
 * @file models/Message.js
 * @description Mongoose schema and model for individual RAG conversation turns.
 *
 *   Each Message represents a single question–answer exchange (one turn) within
 *   a Conversation. The schema stores everything needed to reconstruct a full
 *   chat transcript including provenance — which documents and chunks fed the
 *   answer — without storing raw chunk text inline (keeping documents lean).
 *
 *   Hierarchy
 *   ─────────
 *   User
 *     └─ Conversation
 *          └─ Message  ← this model
 *
 *   Design decisions
 *   ─────────────────
 *   • `userId` is denormalised (copied from the parent Conversation) so that
 *     access-control queries on messages never require a join.
 *   • `sources` stores a lightweight snapshot of document metadata at answer-
 *     time. This means the history remains intact even if the source document
 *     is later deleted by the user.
 *   • `retrievalMetadata` captures statistics about the retrieval stage
 *     (how many chunks were found, what the top similarity score was) for
 *     future analytics and quality monitoring without storing full chunk text.
 *   • `llmMetadata` captures the generation-stage details (model, token usage,
 *     finish reason, prompt template) for cost tracking and A/B comparison.
 *   • `sequenceIndex` maintains the canonical ordering of turns within a
 *     conversation; combined with `conversationId` it provides O(1) look-ups
 *     for "next" and "previous" turn navigation.
 *   • `isError` flags turns where the RAG pipeline failed so the UI can render
 *     them differently without filtering them out of the history.
 */

const mongoose = require('mongoose');

// ── Sub-schemas ───────────────────────────────────────────────────────────────

/**
 * Snapshot of a source document at answer-time.
 * Denormalised so history survives document deletion.
 */
const sourceSnapshotSchema = new mongoose.Schema(
  {
    /** Original Document._id — kept for deep-linking even after deletion. */
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref : 'Document',
    },

    /** Human-readable filename as stored in Document.originalName. */
    originalName: {
      type: String,
      trim: true,
    },

    /** MIME type of the source file (e.g. 'application/pdf'). */
    fileType: {
      type: String,
      trim: true,
    },

    /** Upload date — snapshot of Document.uploadDate. */
    uploadDate: {
      type: Date,
    },
  },
  { _id: false } // sub-documents — no separate _id needed
);

/**
 * Statistics about the retrieval stage of the RAG pipeline.
 */
const retrievalMetadataSchema = new mongoose.Schema(
  {
    /** Number of chunks returned by the similarity search. */
    chunksRetrieved: {
      type   : Number,
      default: 0,
      min    : 0,
    },

    /** Cosine similarity score of the top-ranked chunk (0–1). */
    topScore: {
      type: Number,
      min : 0,
      max : 1,
    },

    /** Embedding model used to encode the query (e.g. 'text-embedding-004'). */
    embeddingModel: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Statistics and settings from the LLM generation stage.
 */
const llmMetadataSchema = new mongoose.Schema(
  {
    /** Gemini (or other) model identifier (e.g. 'gemini-2.0-flash'). */
    model: {
      type: String,
      trim: true,
    },

    /** Number of tokens consumed by the prompt. */
    promptTokens: {
      type   : Number,
      default: 0,
      min    : 0,
    },

    /** Number of tokens in the generated response. */
    outputTokens: {
      type   : Number,
      default: 0,
      min    : 0,
    },

    /**
     * How the generation ended.
     * Common values: 'STOP', 'MAX_TOKENS', 'SAFETY', 'UNKNOWN'.
     */
    finishReason: {
      type: String,
      trim: true,
    },

    /** Prompt template used to build the context window (e.g. 'standard'). */
    template: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    // ── Ownership & threading ──────────────────────────────────────────────────

    /** Reference to the parent Conversation. */
    conversationId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Conversation',
      required: [true, 'conversationId is required'],
      index   : true,
    },

    /**
     * Denormalised user reference (copied from the parent Conversation).
     * Enables ownership checks on messages without joining Conversation.
     */
    userId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'User',
      required: [true, 'userId is required'],
      index   : true,
    },

    /**
     * 0-based position of this turn within the conversation.
     * Combined with conversationId, gives the canonical message order.
     */
    sequenceIndex: {
      type    : Number,
      required: [true, 'sequenceIndex is required'],
      min     : [0, 'sequenceIndex must be at least 0'],
    },

    // ── Turn content ───────────────────────────────────────────────────────────

    /** The raw question submitted by the user. */
    question: {
      type    : String,
      required: [true, 'question is required'],
      trim    : true,
      maxlength: [4000, 'question cannot exceed 4000 characters'],
    },

    /**
     * The answer generated by the LLM.
     * Empty string on error turns (isError: true) where no answer was produced.
     */
    answer: {
      type    : String,
      required: [true, 'answer is required'],
      trim    : true,
      default : '',
    },

    // ── RAG provenance ─────────────────────────────────────────────────────────

    /**
     * Snapshot of the documents that provided the retrieval context for this turn.
     * Stored at answer-time so the citation list remains accurate if source
     * documents are later updated or deleted.
     */
    sources: {
      type   : [sourceSnapshotSchema],
      default: [],
    },

    /** Statistics about the retrieval stage (chunks found, top score, etc.). */
    retrievalMetadata: {
      type   : retrievalMetadataSchema,
      default: () => ({}),
    },

    /** Statistics and settings from the LLM generation stage. */
    llmMetadata: {
      type   : llmMetadataSchema,
      default: () => ({}),
    },

    // ── Status ─────────────────────────────────────────────────────────────────

    /**
     * True if the RAG pipeline returned an error for this turn.
     * The UI can render error turns differently (e.g. with a retry button).
     */
    isError: {
      type   : Boolean,
      default: false,
    },

    /**
     * Error message stored when isError is true.
     * Not exposed to the client in production — used for internal diagnostics.
     */
    errorMessage: {
      type   : String,
      default: null,
    },
  },
  {
    /**
     * Mongoose adds:
     *   createdAt — when this turn was stored (primary "created timestamp")
     *   updatedAt — last modification (e.g. if a message were ever edited)
     */
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/**
 * Primary query: "Return all messages for a conversation, in order."
 *   db.messages.find({ conversationId }).sort({ sequenceIndex: 1 })
 *
 * Unique constraint prevents duplicate sequence positions in a conversation,
 * acting as a safeguard against race conditions in the message-write layer.
 */
messageSchema.index(
  { conversationId: 1, sequenceIndex: 1 },
  { unique: true, name: 'conversation_sequence' }
);

/**
 * Secondary query: "Return all messages belonging to a user."
 * Used for user-level audit, export, and hard-delete cascades.
 */
messageSchema.index(
  { userId: 1, createdAt: -1 },
  { name: 'user_history' }
);

// ── Model ─────────────────────────────────────────────────────────────────────

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;

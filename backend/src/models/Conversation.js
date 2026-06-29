/**
 * @file models/Conversation.js
 * @description Mongoose schema and model for chat conversations.
 *
 *   A Conversation groups all Messages exchanged between one user and the
 *   RAG assistant within a single named session. It acts as the top-level
 *   container in the chat history hierarchy:
 *
 *     User
 *       └─ Conversation  (this model)
 *            └─ Message  (future — Message model will ref Conversation._id)
 *
 *   Design decisions
 *   ─────────────────
 *   • `title` defaults to a timestamp-based label so new conversations always
 *     have a readable name without requiring the client to supply one.
 *   • `messageCount` is a denormalised counter kept in sync by the Message
 *     service to avoid costly aggregation on every list request.
 *   • `lastMessageAt` is updated every time a new message is appended,
 *     enabling efficient sorting of conversations by recency.
 *   • `metadata` is an open Mixed field reserved for future features such as
 *     topic tagging, pinning, sharing, and export settings.
 *   • `isArchived` soft-deletes conversations from the default list view
 *     without destroying history.
 */

const mongoose = require('mongoose');

// ── Schema ────────────────────────────────────────────────────────────────────

const conversationSchema = new mongoose.Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────────

    /** The user who owns this conversation. */
    userId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'User',
      required: [true, 'userId is required'],
      index   : true,   // fast look-up of all conversations for a user
    },

    // ── Identity ───────────────────────────────────────────────────────────────

    /**
     * Human-readable title for the conversation.
     * Defaults to an ISO-date-based label; the client may update it later
     * (e.g. auto-summarised from the first question).
     */
    title: {
      type   : String,
      trim   : true,
      default: () => `Conversation — ${new Date().toLocaleDateString('en-GB', {
        day  : '2-digit',
        month: 'short',
        year : 'numeric',
      })}`,
      maxlength: [200, 'title cannot exceed 200 characters'],
    },

    // ── Activity tracking ──────────────────────────────────────────────────────

    /**
     * Timestamp of the most recent message appended to this conversation.
     * Updated by the message-persistence layer each time a new turn is saved.
     * Null for brand-new, empty conversations.
     */
    lastMessageAt: {
      type   : Date,
      default: null,
      index  : true,   // used for sorting conversations by recency
    },

    /**
     * Denormalised count of messages in this conversation.
     * Incremented by the message-persistence layer to avoid COUNT aggregations
     * on every list request.
     */
    messageCount: {
      type   : Number,
      default: 0,
      min    : [0, 'messageCount cannot be negative'],
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Soft-delete flag.
     * Archived conversations are hidden from the default list view but
     * retained in the database for audit and potential restoration.
     */
    isArchived: {
      type   : Boolean,
      default: false,
      index  : true,
    },

    // ── Extensibility ─────────────────────────────────────────────────────────

    /**
     * Open metadata bag for future features:
     *   - topic tags
     *   - pinned / starred state
     *   - sharing / export settings
     *   - AI-generated summary
     */
    metadata: {
      type   : mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    /**
     * Mongoose automatically adds:
     *   createdAt — conversation creation timestamp
     *   updatedAt — last schema-level modification timestamp
     *
     * Note: `updatedAt` reflects Mongoose saves; `lastMessageAt` is the
     * authoritative "last activity" timestamp updated by the message layer.
     */
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/**
 * Compound index for the most common list query:
 *   "Return all non-archived conversations for userId, newest activity first."
 *
 *   db.conversations.find({ userId, isArchived: false })
 *                   .sort({ lastMessageAt: -1 })
 */
conversationSchema.index(
  { userId: 1, isArchived: 1, lastMessageAt: -1 },
  { name: 'user_active_recency' }
);

// ── Model ─────────────────────────────────────────────────────────────────────

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

/**
 * @file services/conversationService.js
 * @description Service layer for conversation and message persistence.
 *
 *   Manages the full lifecycle of a chat conversation:
 *     create → append messages → read history → list → archive
 *
 *   Atomic message appending
 *   ────────────────────────
 *   A message's `sequenceIndex` must be unique within its conversation.
 *   To prevent races when concurrent requests hit the same conversation,
 *   we derive the index with a single atomic findOneAndUpdate on Conversation
 *   (using $inc on messageCount and returning the OLD document so the
 *   pre-increment value becomes the new message's index). The unique compound
 *   index on Message { conversationId, sequenceIndex } acts as a final
 *   safety net.
 *
 *   Public API
 *   ──────────
 *   createConversation(userId, [title])                        → Conversation
 *   addMessage(conversationId, userId, payload)                → Message
 *   getConversationHistory(conversationId, userId, [options])  → Message[]
 *   getConversation(conversationId, userId)                    → Conversation
 *   getUserConversations(userId, [options])                    → { conversations, pagination }
 *   updateConversationTitle(conversationId, userId, title)     → Conversation
 *   archiveConversation(conversationId, userId)                → Conversation
 */

const mongoose               = require('mongoose');
const { Conversation, Message } = require('../models');
const AppError               = require('../utils/AppError');
const logger                 = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate and normalise a MongoDB ObjectId string.
 * Throws AppError 400 if invalid.
 *
 * @param {string|mongoose.Types.ObjectId} id
 * @param {string} fieldName  – used in the error message
 * @returns {string}          – string form of the id
 */
const validateObjectId = (id, fieldName = 'id') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw AppError.badRequest(
      `conversationService: "${fieldName}" must be a valid MongoDB ObjectId.`
    );
  }
  return id.toString();
};

// ── createConversation ────────────────────────────────────────────────────────

/**
 * Create a new, empty conversation for the given user.
 *
 * @param {string} userId        - Authenticated user's ObjectId.
 * @param {string} [title]       - Optional title; defaults to a date-based label.
 * @returns {Promise<import('mongoose').Document>} The saved Conversation document.
 * @throws {AppError} 400 – invalid userId
 */
const createConversation = async (userId, title = undefined) => {
  validateObjectId(userId, 'userId');

  const conversation = new Conversation({
    userId,
    ...(title ? { title: title.trim() } : {}),
  });

  await conversation.save();

  logger.info(
    `[conversationService] Created conversation: ${conversation._id} for user: ${userId}`
  );

  return conversation;
};

// ── addMessage ────────────────────────────────────────────────────────────────

/**
 * Atomically append a question–answer turn to a conversation.
 *
 * Steps:
 *   1. Verify the conversation exists and belongs to the user.
 *   2. Increment messageCount and update lastMessageAt on the Conversation
 *      in a single atomic findOneAndUpdate — the old messageCount becomes
 *      the new message's sequenceIndex.
 *   3. Persist the Message document.
 *
 * @param {string} conversationId
 * @param {string} userId
 * @param {object} payload
 * @param {string}   payload.question
 * @param {string}   payload.answer
 * @param {object[]} [payload.sources=[]]            – document snapshots
 * @param {object}   [payload.retrievalMetadata={}]  – retrieval stats
 * @param {object}   [payload.llmMetadata={}]        – LLM generation stats
 * @param {boolean}  [payload.isError=false]
 * @param {string}   [payload.errorMessage]
 *
 * @returns {Promise<import('mongoose').Document>} The saved Message document.
 * @throws {AppError} 400 – invalid ids or missing required fields
 * @throws {AppError} 404 – conversation not found or not owned by user
 */
const addMessage = async (conversationId, userId, payload) => {
  validateObjectId(conversationId, 'conversationId');
  validateObjectId(userId, 'userId');

  const { question, answer = '', sources = [], retrievalMetadata = {},
          llmMetadata = {}, isError = false, errorMessage = null } = payload;

  if (!question || typeof question !== 'string' || !question.trim()) {
    throw AppError.badRequest('conversationService.addMessage: question must be a non-empty string.');
  }

  // ── 1. Atomically claim the next sequence index ────────────────────────────
  //   findOneAndUpdate with { new: false } returns the document BEFORE update,
  //   so old.messageCount is the correct 0-based index for the new message.
  const oldConversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId, isArchived: false },
    {
      $inc: { messageCount: 1 },
      $set: { lastMessageAt: new Date() },
    },
    { new: false } // return pre-update document
  );

  if (!oldConversation) {
    throw AppError.notFound(
      'Conversation not found, not owned by this user, or has been archived.'
    );
  }

  const sequenceIndex = oldConversation.messageCount; // 0-based

  // ── 2. Persist the message ─────────────────────────────────────────────────
  try {
    const message = await Message.create({
      conversationId,
      userId,
      sequenceIndex,
      question : question.trim(),
      answer   : typeof answer === 'string' ? answer.trim() : '',
      sources,
      retrievalMetadata,
      llmMetadata,
      isError,
      errorMessage: isError ? (errorMessage ?? null) : null,
    });

    logger.info(
      `[conversationService] Appended message #${sequenceIndex} to conversation: ${conversationId}`
    );

    return message;

  } catch (err) {
    // Roll back the counter if the message insert fails
    await Conversation.findByIdAndUpdate(conversationId, {
      $inc: { messageCount: -1 },
    }).catch(() => {}); // best-effort; do not mask original error

    if (err.name === 'ValidationError') {
      const fields = Object.fromEntries(
        Object.entries(err.errors).map(([f, e]) => [f, e.message])
      );
      throw AppError.badRequest('Message validation failed.', [fields]);
    }
    if (err.code === 11000) {
      throw AppError.conflict('A message with this sequence index already exists in the conversation.');
    }

    logger.error(`[conversationService] Failed to save message: ${err.message}`);
    throw AppError.internal('Failed to save message to database.');
  }
};

// ── getConversationHistory ────────────────────────────────────────────────────

/**
 * Retrieve the ordered message history for a conversation.
 *
 * @param {string} conversationId
 * @param {string} userId
 * @param {object} [options={}]
 * @param {number} [options.limit=50]   – max messages to return (1–200)
 * @param {number} [options.skip=0]     – offset for pagination
 *
 * @returns {Promise<{
 *   conversation: object,
 *   messages    : object[],
 *   pagination  : { total: number, limit: number, skip: number },
 * }>}
 * @throws {AppError} 404 – conversation not found
 */
const getConversationHistory = async (conversationId, userId, options = {}) => {
  validateObjectId(conversationId, 'conversationId');
  validateObjectId(userId, 'userId');

  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
  const skip  = Math.max(parseInt(options.skip,  10) || 0, 0);

  // Fetch conversation and verify ownership in parallel with the message query
  const [conversation, messages, total] = await Promise.all([
    Conversation.findOne({ _id: conversationId, userId }).lean(),
    Message.find({ conversationId, userId })
      .sort({ sequenceIndex: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments({ conversationId, userId }),
  ]);

  if (!conversation) {
    throw AppError.notFound('Conversation not found or not owned by this user.');
  }

  logger.info(
    `[conversationService] Fetched ${messages.length} message(s) ` +
    `(skip: ${skip}, limit: ${limit}) for conversation: ${conversationId}`
  );

  return {
    conversation,
    messages,
    pagination: { total, limit, skip },
  };
};

// ── getConversation ───────────────────────────────────────────────────────────

/**
 * Fetch a single conversation by ID, scoped to the authenticated user.
 *
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<import('mongoose').Document>}
 * @throws {AppError} 404 – not found or not owned
 */
const getConversation = async (conversationId, userId) => {
  validateObjectId(conversationId, 'conversationId');
  validateObjectId(userId, 'userId');

  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId,
  }).lean();

  if (!conversation) {
    throw AppError.notFound('Conversation not found or not owned by this user.');
  }

  return conversation;
};

// ── getUserConversations ──────────────────────────────────────────────────────

/**
 * List all non-archived conversations for a user, sorted by most recent activity.
 *
 * @param {string} userId
 * @param {object} [options={}]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {boolean} [options.includeArchived=false]
 *
 * @returns {Promise<{
 *   conversations: object[],
 *   pagination   : { total, page, limit, totalPages },
 * }>}
 */
const getUserConversations = async (userId, options = {}) => {
  validateObjectId(userId, 'userId');

  const page            = Math.max(parseInt(options.page,  10) || 1, 1);
  const limit           = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
  const skip            = (page - 1) * limit;
  const includeArchived = options.includeArchived === true;

  const filter = { userId, ...(includeArchived ? {} : { isArchived: false }) };

  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  logger.info(
    `[conversationService] Fetched ${conversations.length} conversation(s) ` +
    `(page: ${page}, limit: ${limit}) for user: ${userId}`
  );

  return {
    conversations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ── updateConversationTitle ───────────────────────────────────────────────────

/**
 * Rename a conversation.
 *
 * @param {string} conversationId
 * @param {string} userId
 * @param {string} title
 * @returns {Promise<import('mongoose').Document>}
 * @throws {AppError} 400 – blank title
 * @throws {AppError} 404 – not found
 */
const updateConversationTitle = async (conversationId, userId, title) => {
  validateObjectId(conversationId, 'conversationId');
  validateObjectId(userId, 'userId');

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw AppError.badRequest('title must be a non-empty string.');
  }

  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { $set: { title: title.trim() } },
    { new: true, runValidators: true }
  );

  if (!conversation) {
    throw AppError.notFound('Conversation not found or not owned by this user.');
  }

  logger.info(`[conversationService] Renamed conversation: ${conversationId} → "${title.trim()}"`);

  return conversation;
};

// ── archiveConversation ───────────────────────────────────────────────────────

/**
 * Soft-delete a conversation (set isArchived = true).
 * The conversation and its messages are retained for audit.
 *
 * @param {string} conversationId
 * @param {string} userId
 * @returns {Promise<import('mongoose').Document>}
 * @throws {AppError} 404 – not found
 */
const archiveConversation = async (conversationId, userId) => {
  validateObjectId(conversationId, 'conversationId');
  validateObjectId(userId, 'userId');

  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { $set: { isArchived: true } },
    { new: true }
  );

  if (!conversation) {
    throw AppError.notFound('Conversation not found or not owned by this user.');
  }

  logger.info(`[conversationService] Archived conversation: ${conversationId}`);

  return conversation;
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  createConversation,
  addMessage,
  getConversationHistory,
  getConversation,
  getUserConversations,
  updateConversationTitle,
  archiveConversation,
};

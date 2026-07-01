/**
 * @file services/analyticsService.js
 * @description Dashboard analytics service.
 *
 *   Computes platform-wide statistics in a single function call using
 *   parallel MongoDB operations — no sequential queries, no N+1 reads.
 *
 *   Design principles
 *   ─────────────────
 *   • All counts run concurrently via Promise.all.
 *   • Aggregation pipelines are used where breakdown data is needed
 *     (e.g. documents by status, chunks with/without embeddings).
 *   • Simple countDocuments() is used where only a total is needed —
 *     it is faster than a $count aggregation for large collections.
 *   • Every field defaults gracefully (0 / null) if the collection is empty.
 *
 *   AnalyticsResult shape
 *   ─────────────────────
 *   {
 *     generatedAt  : Date,          // timestamp of this snapshot
 *     totals: {
 *       users         : number,
 *       documents     : number,
 *       conversations : number,
 *       messages      : number,
 *       chunks        : number,
 *     },
 *     documents: {
 *       byStatus: {
 *         pending    : number,
 *         processing : number,
 *         processed  : number,
 *         chunked    : number,
 *         embedded   : number,
 *         indexed    : number,
 *         failed     : number,
 *       },
 *       totalEmbedded   : number,   // docs with status 'indexed'
 *       totalSizeBytes  : number,   // sum of fileSize across all documents
 *     },
 *     chunks: {
 *       withEmbedding    : number,  // chunks that have a stored embedding vector
 *       withoutEmbedding : number,  // chunks pending the embed pipeline
 *     },
 *     conversations: {
 *       active   : number,          // isArchived = false
 *       archived : number,          // isArchived = true
 *     },
 *     messages: {
 *       errorMessages : number,     // isError = true
 *     },
 *   }
 *
 *   Public API
 *   ──────────
 *   getStats() → Promise<AnalyticsResult>
 */

const { User, Document, Chunk, Conversation, Message } = require('../models');
const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');

// ── getStats ──────────────────────────────────────────────────────────────────

/**
 * Compute and return all platform analytics statistics.
 *
 * All DB operations run in parallel — the total wall-clock time is bounded
 * by the slowest single query, not their sum.
 *
 * @returns {Promise<AnalyticsResult>}
 * @throws  {AppError} 500 – if the DB queries fail
 */
const getStats = async () => {
  logger.info('[analyticsService] Computing dashboard statistics…');

  try {
    // ── Run all queries concurrently ───────────────────────────────────────
    const [
      totalUsers,
      totalMessages,
      docAggregation,
      chunkAggregation,
      conversationAggregation,
      messageErrorCount,
    ] = await Promise.all([

      // 1. Total registered users
      User.countDocuments(),

      // 2. Total messages (all turns across all conversations)
      Message.countDocuments(),

      // 3. Document totals — broken down by status + file size sum
      Document.aggregate([
        {
          $group: {
            _id           : '$status',
            count         : { $sum: 1 },
            totalSizeBytes: { $sum: { $ifNull: ['$fileSize', 0] } },
          },
        },
      ]),

      // 4. Chunk totals — split by whether an embedding vector is stored
      Chunk.aggregate([
        {
          $group: {
            _id  : {
              $cond: [
                {
                  $and: [
                    { $isArray: '$embedding' },
                    { $gt: [{ $size: { $ifNull: ['$embedding', []] } }, 0] },
                  ],
                },
                'withEmbedding',
                'withoutEmbedding',
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Conversation totals — split by archived flag
      Conversation.aggregate([
        {
          $group: {
            _id  : '$isArchived',
            count: { $sum: 1 },
          },
        },
      ]),

      // 6. Error message count (turns where LLM generation failed)
      Message.countDocuments({ isError: true }),
    ]);

    // ── Process document aggregation ───────────────────────────────────────
    const KNOWN_STATUSES = ['pending', 'processing', 'processed', 'chunked', 'embedded', 'indexed', 'failed'];

    const docByStatus = Object.fromEntries(KNOWN_STATUSES.map((s) => [s, 0]));
    let totalDocuments    = 0;
    let totalDocSizeBytes = 0;

    for (const bucket of docAggregation) {
      const status = bucket._id ?? 'unknown';
      if (status in docByStatus) {
        docByStatus[status] = bucket.count;
      } else {
        // unexpected status — count it under a catch-all key
        docByStatus[status] = (docByStatus[status] ?? 0) + bucket.count;
      }
      totalDocuments    += bucket.count;
      totalDocSizeBytes += bucket.totalSizeBytes ?? 0;
    }

    // ── Process chunk aggregation ──────────────────────────────────────────
    let chunksWithEmbedding    = 0;
    let chunksWithoutEmbedding = 0;
    let totalChunks            = 0;

    for (const bucket of chunkAggregation) {
      if (bucket._id === 'withEmbedding') {
        chunksWithEmbedding = bucket.count;
      } else {
        chunksWithoutEmbedding += bucket.count;
      }
      totalChunks += bucket.count;
    }

    // ── Process conversation aggregation ──────────────────────────────────
    let activeConversations   = 0;
    let archivedConversations = 0;
    let totalConversations    = 0;

    for (const bucket of conversationAggregation) {
      if (bucket._id === false || bucket._id === null) {
        activeConversations = bucket.count;    // isArchived = false
      } else {
        archivedConversations = bucket.count;  // isArchived = true
      }
      totalConversations += bucket.count;
    }

    // ── Assemble result ────────────────────────────────────────────────────
    const result = {
      generatedAt: new Date(),

      totals: {
        users        : totalUsers,
        documents    : totalDocuments,
        conversations: totalConversations,
        messages     : totalMessages,
        chunks       : totalChunks,
      },

      documents: {
        byStatus      : docByStatus,
        totalEmbedded : docByStatus.indexed ?? 0,
        totalSizeBytes: totalDocSizeBytes,
      },

      chunks: {
        withEmbedding   : chunksWithEmbedding,
        withoutEmbedding: chunksWithoutEmbedding,
      },

      conversations: {
        active  : activeConversations,
        archived: archivedConversations,
      },

      messages: {
        errorMessages: messageErrorCount,
      },
    };

    logger.info(
      `[analyticsService] Stats computed — ` +
      `users: ${result.totals.users}, ` +
      `docs: ${result.totals.documents}, ` +
      `chunks: ${result.totals.chunks}, ` +
      `conversations: ${result.totals.conversations}, ` +
      `messages: ${result.totals.messages}`
    );

    return result;

  } catch (err) {
    logger.error(`[analyticsService] Failed to compute stats: ${err.message}`);
    throw AppError.internal('Failed to retrieve analytics data.');
  }
};

// ── getConversationAnalytics ──────────────────────────────────────────────────

/**
 * Compute conversation-specific analytics across all users.
 *
 * @returns {Promise<{
 *   totalConversations: number,
 *   totalQuestions: number,
 *   averageMessagesPerConversation: number,
 *   mostActiveUsers: Array<{
 *     userId: string,
 *     name: string,
 *     email: string,
 *     messageCount: number
 *   }>,
 *   recentActivity: Array<{
 *     messageId: string,
 *     question: string,
 *     answer: string,
 *     createdAt: Date,
 *     userName: string,
 *     conversationTitle: string
 *   }>
 * }>}
 */
const getConversationAnalytics = async () => {
  logger.info('[analyticsService] Computing conversation statistics…');

  try {
    const [
      totalConvs,
      totalMsgs,
      activeUsersData,
      recentMsgs
    ] = await Promise.all([
      // 1. Total conversations
      Conversation.countDocuments(),

      // 2. Total questions (total messages)
      Message.countDocuments(),

      // 3. Most active users (top 5 by message/question count)
      Message.aggregate([
        {
          $group: {
            _id: '$userId',
            messageCount: { $sum: 1 }
          }
        },
        { $sort: { messageCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            name: { $ifNull: ['$user.name', 'Unknown User'] },
            email: { $ifNull: ['$user.email', ''] },
            messageCount: 1
          }
        }
      ]),

      // 4. Recent activity (latest 5 messages, populated with User and Conversation)
      Message.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .populate('conversationId', 'title')
        .lean()
    ]);

    const averageMessages = totalConvs > 0 ? parseFloat((totalMsgs / totalConvs).toFixed(2)) : 0;

    const formattedRecentActivity = recentMsgs.map((msg) => ({
      messageId: msg._id.toString(),
      question: msg.question,
      answer: msg.answer,
      createdAt: msg.createdAt,
      userName: msg.userId?.name || 'Unknown User',
      conversationTitle: msg.conversationId?.title || 'Unknown Conversation',
    }));

    return {
      totalConversations: totalConvs,
      totalQuestions: totalMsgs,
      averageMessagesPerConversation: averageMessages,
      mostActiveUsers: activeUsersData,
      recentActivity: formattedRecentActivity
    };

  } catch (err) {
    logger.error(`[analyticsService.getConversationAnalytics] Failed: ${err.message}`);
    throw AppError.internal('Failed to retrieve conversation analytics.');
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getStats,
  getConversationAnalytics
};

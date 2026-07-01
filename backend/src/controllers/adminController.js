/**
 * @file controllers/adminController.js
 * @description Request handlers for administrator-only dashboard endpoints.
 *
 *   Layer responsibilities
 *   ──────────────────────
 *   • Restricts access to system-wide metrics.
 *   • Composes global stats, global doc stats, and global conversation stats.
 *   • Runs queries in parallel to keep execution time minimal.
 *
 *   Routes (mounted at /api/v1/admin)
 *   ─────────────────────────────────
 *   GET /dashboard → getDashboardAnalytics
 */

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/ApiResponse');
const { analyticsService, documentService } = require('../services');

/**
 * Fetch system-wide admin dashboard analytics.
 *
 * Returns:
 *   - platform statistics (totals, status breakdowns)
 *   - global document analytics (largest doc, latest docs, avg chunks)
 *   - global conversation analytics (most active users, recent activity turns)
 *
 * @route  GET /api/v1/admin/dashboard
 * @access Private (Admin only)
 */
const getDashboardAnalytics = asyncHandler(async (req, res) => {
  // Compute all system-wide stats in parallel for speed
  const [stats, docAnalytics, convAnalytics] = await Promise.all([
    analyticsService.getStats(),
    documentService.getDocumentAnalytics(), // null argument computes globally
    analyticsService.getConversationAnalytics(),
  ]);

  return successResponse(res, 200, 'Admin dashboard analytics fetched successfully.', {
    stats,
    documentAnalytics: docAnalytics,
    conversationAnalytics: convAnalytics,
  });
});

module.exports = {
  getDashboardAnalytics,
};

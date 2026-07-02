/**
 * @file routes/documentRoutes.js
 * @description Document management routes.
 *
 *   Base path (mounted in routes/index.js): /api/v1/documents
 *
 *   ┌────────┬─────────────┬─────────────────┬───────────────────────────────────────┐
 *   │ Method │ Path          │ Middleware      │ Description                           │
 *   ├────────┼─────────────┼─────────────────┼───────────────────────────────────────┤
 *   │ POST   │ /upload       │ authenticate    │ Upload a single document              │
 *   │        │               │ uploadSingle    │                                       │
 *   ├────────┼─────────────┼─────────────────┼───────────────────────────────────────┤
 *   │ GET    │ /             │ authenticate    │ List user’s docs (paginated)          │
 *   │        │               │                 │ ?page=1&limit=10                      │
 *   ├────────┼─────────────┼─────────────────┼───────────────────────────────────────┤
 *   │ GET    │ /:id          │ authenticate    │ Fetch a single document by ID         │
 *   ├────────┼─────────────┼─────────────────┼───────────────────────────────────────┤
 *   │ POST   │ /:id/process  │ authenticate    │ Extract text from an uploaded PDF     │
 *   └────────┴─────────────┴─────────────────┴───────────────────────────────────────┘
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { uploadSingle } = require('../middleware/upload');
const {
  uploadDocument,
  getDocuments,
  getDocument,
  processDocument,
  chunkDocument,
  embedDocument,
  getDocumentAnalytics,
  deleteDocument,
  reprocessDocument,
} = require('../controllers/documentController');

const router = express.Router();

// ── POST /upload — single file (field: "document") ───────────────────────────
//
//   Middleware chain:
//   1. authenticate  — verifies JWT, attaches req.user
//   2. uploadSingle  — runs Multer, validates type/size, writes to uploads/
//   3. uploadDocument — saves metadata to MongoDB, returns document record
//
router.post(
  '/upload',
  authenticate,
  uploadSingle('document'),
  uploadDocument
);

// ── GET /analytics — retrieve document-specific analytics for the user ────────
//
//   Must be defined BEFORE GET /:id so it doesn't get treated as an ID.
//
router.get(
  '/analytics',
  authenticate,
  getDocumentAnalytics
);

// ── GET / — list the caller's documents (paginated, newest first) ─────────────
//
//   Query params: ?page=<n>&limit=<n>
//   Defaults: page=1, limit=10, max limit=100
//
router.get(
  '/',
  authenticate,
  getDocuments
);

// ── GET /:id — fetch a single document by MongoDB ObjectId ────────────────────
//
//   Returns 400 for a malformed id, 404 if not found or not owned by caller.
//
router.get(
  '/:id',
  authenticate,
  getDocument
);

// ── DELETE /:id — delete document file, metadata, and chunks/embeddings ─────────
//
//   Returns 400 for a malformed id, 404 if not found or not owned by caller.
//
router.delete(
  '/:id',
  authenticate,
  deleteDocument
);

// ── POST /:id/process — extract text from a previously uploaded PDF ────────────────
//
//   Middleware chain:
//   1. authenticate    — verifies JWT, attaches req.user
//   2. processDocument — runs pdfService, updates doc status, returns text
//
router.post(
  '/:id/process',
  authenticate,
  processDocument
);

// ── POST /:id/chunk — segment document text into chunks ─────────────────────────
//
//   Middleware chain:
//   1. authenticate  — verifies JWT, attaches req.user
//   2. chunkDocument — retrieves document, chunks it, saves chunks, returns summary
//
router.post(
  '/:id/chunk',
  authenticate,
  chunkDocument
);

// ── POST /:id/embed — generate vector embeddings for all document chunks ──────────
//
//   Middleware chain:
//   1. authenticate  — verifies JWT, attaches req.user
//   2. embedDocument — runs embeddingPipelineService, returns stats
//
router.post(
  '/:id/embed',
  authenticate,
  embedDocument
);

// ── POST /:id/reprocess — sequentially re-extract, chunk, and embed ───────────────
//
//   Middleware chain:
//   1. authenticate      — verifies JWT, attaches req.user
//   2. reprocessDocument — runs reprocessDocument pipeline
//
router.post(
  '/:id/reprocess',
  authenticate,
  reprocessDocument
);

module.exports = router;

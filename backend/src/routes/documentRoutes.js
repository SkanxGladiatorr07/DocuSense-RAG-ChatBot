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

module.exports = router;

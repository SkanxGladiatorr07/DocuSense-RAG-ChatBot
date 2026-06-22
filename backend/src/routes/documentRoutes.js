/**
 * @file routes/documentRoutes.js
 * @description Document upload routes.
 *
 *   Base path (mounted in routes/index.js): /api/v1/documents
 *
 *   ┌──────────────────────────────────────────────────────────────────────────┐
 *   │ Method │ Path           │ Middleware              │ Description           │
 *   ├────────┼────────────────┼─────────────────────────┼──────────────────────┤
 *   │ POST   │ /upload        │ authenticate, upload    │ Upload one document   │
 *   │ POST   │ /upload-many   │ authenticate, upload    │ Upload up to 10 docs  │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 *   NOTE: `authenticate` is commented-out during initial scaffolding so the
 *   endpoints can be tested without a token.  Uncomment before shipping.
 */

const express  = require('express');
const { uploadSingle, uploadArray } = require('../middleware/upload');
const { uploadDocument, uploadDocuments } = require('../controllers/documentController');
// const authenticate = require('../middleware/authenticate');

const router = express.Router();

// ── POST /upload — single file (field: "document") ───────────────────────────
router.post(
  '/upload',
  // authenticate,          // ← uncomment when auth is wired end-to-end
  uploadSingle('document'),
  uploadDocument
);

// ── POST /upload-many — up to 10 files (field: "documents") ──────────────────
router.post(
  '/upload-many',
  // authenticate,          // ← uncomment when auth is wired end-to-end
  uploadArray('documents', 10),
  uploadDocuments
);

module.exports = router;

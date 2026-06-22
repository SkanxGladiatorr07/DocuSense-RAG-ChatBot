/**
 * @file routes/documentRoutes.js
 * @description Document upload routes.
 *
 *   Base path (mounted in routes/index.js): /api/v1/documents
 *
 *   ┌─────────────────────────────────────────────────────────────────────────┐
 *   │ Method │ Path      │ Middleware                    │ Description         │
 *   ├────────┼───────────┼──────────────────────────────┼─────────────────────┤
 *   │ POST   │ /upload   │ authenticate → uploadSingle   │ Upload one document  │
 *   └─────────────────────────────────────────────────────────────────────────┘
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { uploadSingle } = require('../middleware/upload');
const { uploadDocument } = require('../controllers/documentController');

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

module.exports = router;

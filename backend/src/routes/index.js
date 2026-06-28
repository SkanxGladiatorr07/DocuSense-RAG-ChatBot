const express = require('express');
const healthRoutes   = require('./healthRoutes');
const authRoutes     = require('./authRoutes');
const testRoutes     = require('./testRoutes');
const documentRoutes = require('./documentRoutes');
const searchRoutes   = require('./searchRoutes');
const chatRoutes     = require('./chatRoutes');

const router = express.Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.use('/', healthRoutes);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── RBAC Test Routes (dev / integration testing) ──────────────────────────────
router.use('/test', testRoutes);

// ── Documents ─────────────────────────────────────────────────────────────────
router.use('/documents', documentRoutes);

// ── Semantic Search ───────────────────────────────────────────────────────────
router.use('/search', searchRoutes);

// ── Chat (RAG Q&A) ────────────────────────────────────────────────────────────
router.use('/chat', chatRoutes);

module.exports = router;



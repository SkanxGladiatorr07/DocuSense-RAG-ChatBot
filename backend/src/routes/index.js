const express = require('express');
const healthRoutes   = require('./healthRoutes');
const authRoutes     = require('./authRoutes');
const testRoutes     = require('./testRoutes');
const documentRoutes = require('./documentRoutes');
const searchRoutes   = require('./searchRoutes');
const chatRoutes     = require('./chatRoutes');
const conversationRoutes = require('./conversationRoutes');
const adminRoutes        = require('./adminRoutes');

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

// ── Conversations ─────────────────────────────────────────────
router.use('/conversations', conversationRoutes);

// ── Admin Dashboard ───────────────────────────────────────────
router.use('/admin', adminRoutes);

module.exports = router;

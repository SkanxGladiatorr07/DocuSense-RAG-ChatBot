/**
 * @file routes/index.js
 * @description Central route registry — mounts all API sub-routers.
 *              Add new feature routes here as the project grows.
 */

const express = require('express');
const healthRoutes   = require('./healthRoutes');
const authRoutes     = require('./authRoutes');
const testRoutes     = require('./testRoutes');
const documentRoutes = require('./documentRoutes');
// Future route imports go here:
// const chatRoutes = require('./chatRoutes');

const router = express.Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.use('/', healthRoutes);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── RBAC Test Routes (dev / integration testing) ──────────────────────────────
router.use('/test', testRoutes);

// ── Documents ─────────────────────────────────────────────────────────────────
router.use('/documents', documentRoutes);

// ── Feature Routes (uncomment as you build them) ──────────────────────────────
// router.use('/chat', chatRoutes);

module.exports = router;

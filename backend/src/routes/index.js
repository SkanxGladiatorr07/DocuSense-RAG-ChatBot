/**
 * @file routes/index.js
 * @description Central route registry — mounts all API sub-routers.
 *              Add new feature routes here as the project grows.
 */

const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
// Future route imports go here:
// const chatRoutes    = require('./chatRoutes');
// const documentRoutes = require('./documentRoutes');

const router = express.Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.use('/', healthRoutes);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── Feature Routes (uncomment as you build them) ──────────────────────────────
// router.use('/chat',     chatRoutes);
// router.use('/documents', documentRoutes);

module.exports = router;

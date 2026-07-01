/**
 * @file app.js
 * @description Express application factory.
 *              Responsible for middleware registration, route mounting,
 *              and error-handler wiring.
 *              Kept separate from server.js so the app can be imported
 *              cleanly in integration tests without starting a real server.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// ── App Initialisation ────────────────────────────────────────────────────────
const app = express();

// ── Security / CORS ───────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Request Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP Request Logging ──────────────────────────────────────────────────────
// 'dev' format in development (coloured), 'combined' in production (Apache-style)
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Version-agnostic alias: /api/documents (back-compat) ─────────────────────────
// Both of the following paths resolve to the same handlers — no logic is duplicated:
//   POST /api/v1/documents/:id/process  (versioned — preferred)
//   POST /api/documents/:id/process     (unversioned alias — for compatibility)
app.use('/api/documents', require('./routes/documentRoutes'));

// ── Version-agnostic alias: /api/chat ─────────────────────────────────────────
// Reachable at both:
//   POST /api/v1/chat/ask  (versioned — preferred)
//   POST /api/chat/ask     (unversioned alias)
app.use('/api/chat', require('./routes/chatRoutes'));

// ── Version-agnostic alias: /api/conversations ────────────────────────────────
// Reachable at both:
//   /api/v1/conversations  (versioned — preferred)
//   /api/conversations     (unversioned alias — as required)
app.use('/api/conversations', require('./routes/conversationRoutes'));

// ── Version-agnostic alias: /api/admin ───────────────────────────────────────
// Reachable at both:
//   /api/v1/admin/dashboard  (versioned — preferred)
//   /api/admin/dashboard     (unversioned alias — as required)
app.use('/api/admin', require('./routes/adminRoutes'));

// ── Health check at root (as per spec) ───────────────────────────────────────
// Also reachable via GET /api/v1/ through the router above
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'API Running' });
});

// ── 404 Handler (must come after all routes) ──────────────────────────────────
app.use(notFound);

// ── Global Error Handler (must be the very last middleware) ───────────────────
app.use(errorHandler);

module.exports = app;

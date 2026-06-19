/**
 * @file routes/healthRoutes.js
 * @description Routes for infrastructure health checks.
 */

const express = require('express');
const { healthCheck } = require('../controllers/healthController');

const router = express.Router();

// GET /
router.get('/', healthCheck);

module.exports = router;

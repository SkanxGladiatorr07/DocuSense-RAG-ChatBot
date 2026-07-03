/**
 * @file controllers/healthController.js
 * @description Health check controller.
 *              Responds to GET / — used by load-balancers, uptime monitors,
 *              and CI pipelines to verify the API is alive.
 */

const mongoose = require('mongoose');
const env = require('../config/env');
const pkg = require('../../package.json');

const healthCheck = async (req, res) => {
  // 1. Database status check
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbState = mongoose.connection.readyState;
  let dbStatus = 'disconnected';
  if (dbState === 1) {
    dbStatus = 'connected';
  } else if (dbState === 2) {
    dbStatus = 'connecting';
  }

  // 2. Google Gemini API status check
  const apiKey = env.geminiApiKey;
  let aiStatus = 'unconfigured';

  if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '') {
    try {
      // Lightweight, non-generative GET check to verify if the key is authentic and Google is reachable
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      aiStatus = aiResponse.ok ? 'healthy' : 'unauthorized';
    } catch (err) {
      aiStatus = 'unreachable';
    }
  }

  // 3. Determine overall health status
  const isHealthy = dbStatus === 'connected' && aiStatus === 'healthy';
  const serverStatus = isHealthy ? 'healthy' : 'degraded';
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    success: isHealthy,
    message: isHealthy ? 'System is healthy' : 'System is degraded',
    data: {
      status: serverStatus,
      version: pkg.version,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        aiService: aiStatus,
      }
    }
  });
};

module.exports = { healthCheck };

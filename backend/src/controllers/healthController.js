/**
 * @file controllers/healthController.js
 * @description Health check controller.
 *              Responds to GET / — used by load-balancers, uptime monitors,
 *              and CI pipelines to verify the API is alive.
 */

const ApiResponse = require('../utils/ApiResponse');

const healthCheck = (req, res) => {
  ApiResponse.success(res, 200, 'API Running', {
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
};

module.exports = { healthCheck };

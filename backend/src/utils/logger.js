/**
 * @file utils/logger.js
 * @description Lightweight console logger with log levels and timestamps.
 *              Drop-in replacement surface so swapping to Winston / Pino
 *              later only requires editing this one file.
 */

const env = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = env.isDev ? LEVELS.debug : LEVELS.info;

const COLOURS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[35m', // magenta
  reset: '\x1b[0m',
};

const _timestamp = () => new Date().toISOString();

const _log = (level, ...args) => {
  if (LEVELS[level] > CURRENT_LEVEL) return;
  const colour = COLOURS[level] || '';
  const prefix = `${colour}[${_timestamp()}] [${level.toUpperCase()}]${COLOURS.reset}`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](prefix, ...args);
};

const logger = {
  error: (...args) => _log('error', ...args),
  warn: (...args) => _log('warn', ...args),
  info: (...args) => _log('info', ...args),
  debug: (...args) => _log('debug', ...args),
};

module.exports = logger;

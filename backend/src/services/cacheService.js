/**
 * @file services/cacheService.js
 * @description Centralized caching provider interface.
 *
 *   This is structured to be modular so that swapping the current in-memory
 *   implementation for a distributed provider like Redis later requires zero
 *   changes to calling code.
 */

const logger = require('../utils/logger');

// Simple In-Memory Store
class InMemoryCache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Retrieve a value from the cache.
   *
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(key) {
    const item = this.store.get(key);
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      logger.debug(`[cacheService] Cache key expired: ${key}`);
      this.store.delete(key);
      return null;
    }

    logger.debug(`[cacheService] Cache hit: ${key}`);
    // Deep clone to prevent direct modification of cached objects
    return JSON.parse(JSON.stringify(item.value));
  }

  /**
   * Store a value in the cache.
   *
   * @param {string} key
   * @param {any} value
   * @param {number} ttlInSeconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttlInSeconds) {
    const expiresAt = Date.now() + (ttlInSeconds * 1000);
    // Deep clone value before storing
    const valueCopy = JSON.parse(JSON.stringify(value));
    this.store.set(key, { value: valueCopy, expiresAt });
    logger.debug(`[cacheService] Cache set: ${key} | TTL: ${ttlInSeconds}s`);
    return true;
  }

  /**
   * Delete a key from the cache.
   *
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    const deleted = this.store.delete(key);
    logger.debug(`[cacheService] Cache delete: ${key} | Success: ${deleted}`);
    return deleted;
  }

  /**
   * Clear all items from the cache.
   *
   * @returns {Promise<void>}
   */
  async clear() {
    this.store.clear();
    logger.debug('[cacheService] Cache cleared completely.');
  }
}

// Export a single instantiated cache client conforming to this standard interface
const cacheClient = new InMemoryCache();

module.exports = cacheClient;

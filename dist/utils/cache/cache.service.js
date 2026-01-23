"use strict";
/**
 * Cache Service
 *
 * Simple in-memory cache implementation
 * TODO: Add Redis support in the future
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const types_1 = require("./types");
const logger_1 = require("../logger");
class CacheService {
    constructor() {
        this.cache = new Map();
        this.cleanupInterval = null;
        // Start active cleanup on instantiation (Phase 2 Fix)
        this.startCleanup();
    }
    /**
     * Start background cleanup task
     * Runs every 60 seconds to remove expired entries
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // 60 seconds
        // Prevent Node.js from keeping process alive just for this
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
        logger_1.logger.info('[Cache] Active cleanup started (60s interval)');
    }
    /**
     * Clean up expired entries
     * Called automatically every 60 seconds
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            logger_1.logger.debug(`[Cache] Cleanup: removed ${removed} expired entries (${this.cache.size} remaining)`);
        }
    }
    /**
     * Get value from cache
     */
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl = types_1.CacheTTL.Hour) {
        const expiry = Date.now() + ttl * 1000;
        this.cache.set(key, { value, expiry });
        logger_1.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    }
    /**
     * Delete value from cache
     */
    async del(key) {
        this.cache.delete(key);
        logger_1.logger.debug(`Cache deleted: ${key}`);
    }
    /**
     * Delete all keys matching a pattern (prefix)
     * For in-memory cache, we check if key starts with pattern
     */
    async deletePattern(pattern) {
        let deleted = 0;
        const prefix = pattern.replace(/\*$/, ''); // Remove trailing * if present
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                deleted++;
            }
        }
        if (deleted > 0) {
            logger_1.logger.debug(`[Cache] deletePattern: removed ${deleted} keys matching "${pattern}"`);
        }
        return deleted;
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        logger_1.logger.info('Cache cleared');
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Stop cleanup (for graceful shutdown)
     * Call this during application shutdown
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger_1.logger.info('[Cache] Active cleanup stopped');
        }
    }
}
exports.cacheService = new CacheService();

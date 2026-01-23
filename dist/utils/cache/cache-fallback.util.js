"use strict";
/**
 * Cache Fallback Utility
 *
 * Implements stale-while-revalidate pattern for API failure scenarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWithCacheFallback = getWithCacheFallback;
exports.staleWhileRevalidate = staleWhileRevalidate;
const cache_service_1 = require("./cache.service");
const types_1 = require("./types");
const logger_1 = require("../logger");
/**
 * Get data with cache fallback
 * Returns stale data if available when API fails
 */
async function getWithCacheFallback(cacheKey, fetchFn, options = {}) {
    const { ttl = types_1.CacheTTL.FiveMinutes, staleTtl = types_1.CacheTTL.Day } = options;
    try {
        // Try to fetch fresh data
        const freshData = await fetchFn();
        // Cache fresh data
        await cache_service_1.cacheService.set(cacheKey, freshData, ttl);
        return freshData;
    }
    catch (error) {
        logger_1.logger.warn(`API fetch failed, attempting cache fallback: ${cacheKey}`, error);
        // Try to get stale data from cache
        const staleData = await cache_service_1.cacheService.get(cacheKey);
        if (staleData) {
            logger_1.logger.info(`Serving stale data from cache: ${cacheKey}`);
            return staleData;
        }
        // No cache available, throw error
        throw new Error(`API fetch failed and no cache available: ${error.message}`);
    }
}
/**
 * Stale-while-revalidate pattern
 * Returns cached data immediately, refreshes in background
 */
async function staleWhileRevalidate(cacheKey, fetchFn, options = {}) {
    const { ttl = types_1.CacheTTL.FiveMinutes } = options;
    // Get cached data immediately
    const cached = await cache_service_1.cacheService.get(cacheKey);
    if (cached) {
        // Refresh in background (fire and forget)
        fetchFn()
            .then((freshData) => {
            cache_service_1.cacheService.set(cacheKey, freshData, ttl);
            logger_1.logger.debug(`Background refresh completed: ${cacheKey}`);
        })
            .catch((error) => {
            logger_1.logger.warn(`Background refresh failed: ${cacheKey}`, error);
        });
        return cached;
    }
    // No cache, fetch fresh data
    const freshData = await fetchFn();
    await cache_service_1.cacheService.set(cacheKey, freshData, ttl);
    return freshData;
}

"use strict";
/**
 * Match Data Cache Service
 *
 * In-memory cache for match diary and live match data
 * Smart TTL strategy:
 * - Today's matches: 30s (scores change frequently)
 * - Past matches: 1 hour (finished, no changes)
 * - Future matches: 5 minutes (fixtures may change)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.getSmartTTL = getSmartTTL;
exports.getDiaryCacheKey = getDiaryCacheKey;
exports.getDiaryCache = getDiaryCache;
exports.setDiaryCache = setDiaryCache;
exports.invalidateDiaryCache = invalidateDiaryCache;
exports.getCacheStats = getCacheStats;
exports.getLiveMatchesCache = getLiveMatchesCache;
exports.setLiveMatchesCache = setLiveMatchesCache;
exports.invalidateLiveMatchesCache = invalidateLiveMatchesCache;
var node_cache_1 = __importDefault(require("node-cache"));
var logger_1 = require("./logger");
// Initialize cache with checkperiod for automatic cleanup
var cache = new node_cache_1.default({
    stdTTL: 30, // Default TTL: 30 seconds
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false, // Don't clone objects (faster, but be careful with mutations)
});
exports.cache = cache;
/**
 * Get TTL based on date
 * @param date Date string (YYYYMMDD or YYYY-MM-DD)
 * @returns TTL in seconds
 */
function getSmartTTL(date) {
    var dateStr = date.replace(/-/g, '');
    // Today in Turkey timezone (UTC+3)
    var now = new Date();
    var todayTSI = new Date(now.getTime() + (3 * 3600 * 1000));
    var todayStr = todayTSI.toISOString().slice(0, 10).replace(/-/g, '');
    if (dateStr === todayStr) {
        // Today: 30 seconds (live scores changing)
        return 30;
    }
    else if (dateStr < todayStr) {
        // Past: 1 hour (finished matches, no changes)
        return 3600;
    }
    else {
        // Future: 5 minutes (fixtures may change)
        return 300;
    }
}
/**
 * Generate cache key for match diary
 * @param date Date string
 * @param status Optional status filter
 * @returns Cache key
 */
function getDiaryCacheKey(date, status) {
    var dateStr = date.replace(/-/g, '');
    var statusStr = status ? status.sort().join(',') : 'all';
    return "diary:".concat(dateStr, ":").concat(statusStr);
}
/**
 * Get cached diary data
 * @param date Date string
 * @param status Optional status filter
 * @returns Cached data or undefined
 */
function getDiaryCache(date, status) {
    var key = getDiaryCacheKey(date, status);
    var cached = cache.get(key);
    if (cached) {
        logger_1.logger.debug("[Cache] HIT: ".concat(key));
    }
    return cached;
}
/**
 * Set diary cache
 * @param date Date string
 * @param status Optional status filter
 * @param data Data to cache
 */
function setDiaryCache(date, status, data) {
    var key = getDiaryCacheKey(date, status);
    var ttl = getSmartTTL(date);
    cache.set(key, data, ttl);
    logger_1.logger.debug("[Cache] SET: ".concat(key, " (TTL: ").concat(ttl, "s)"));
}
/**
 * Invalidate diary cache for a specific date
 * Call this when match scores change (WebSocket events)
 * @param date Date string
 */
function invalidateDiaryCache(date) {
    var dateStr = date.replace(/-/g, '');
    var keys = cache.keys();
    // Invalidate all cache keys for this date
    var invalidatedCount = 0;
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        if (key.includes("diary:".concat(dateStr, ":"))) {
            cache.del(key);
            invalidatedCount++;
        }
    }
    if (invalidatedCount > 0) {
        logger_1.logger.info("[Cache] INVALIDATED: ".concat(invalidatedCount, " diary cache entries for ").concat(dateStr));
    }
}
/**
 * Get cache stats
 * @returns Cache statistics
 */
function getCacheStats() {
    return {
        keys: cache.keys().length,
        hits: cache.getStats().hits,
        misses: cache.getStats().misses,
        ksize: cache.getStats().ksize,
        vsize: cache.getStats().vsize,
    };
}
// Live matches cache key (always 30s TTL)
var LIVE_CACHE_KEY = 'live:matches';
var LIVE_CACHE_TTL = 30; // 30 seconds
/**
 * Get cached live matches
 * @returns Cached data or undefined
 */
function getLiveMatchesCache() {
    var cached = cache.get(LIVE_CACHE_KEY);
    if (cached) {
        logger_1.logger.debug("[Cache] HIT: ".concat(LIVE_CACHE_KEY));
    }
    return cached;
}
/**
 * Set live matches cache
 * @param data Data to cache
 */
function setLiveMatchesCache(data) {
    cache.set(LIVE_CACHE_KEY, data, LIVE_CACHE_TTL);
    logger_1.logger.debug("[Cache] SET: ".concat(LIVE_CACHE_KEY, " (TTL: ").concat(LIVE_CACHE_TTL, "s)"));
}
/**
 * Invalidate live matches cache
 * Call this when any live match changes
 */
function invalidateLiveMatchesCache() {
    cache.del(LIVE_CACHE_KEY);
    logger_1.logger.debug("[Cache] INVALIDATED: ".concat(LIVE_CACHE_KEY));
}

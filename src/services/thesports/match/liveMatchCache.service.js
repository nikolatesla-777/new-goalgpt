"use strict";
/**
 * Live Match Cache Service
 *
 * Smart caching layer for live matches with event-driven invalidation.
 * Reduces database load while maintaining real-time accuracy.
 *
 * Architecture:
 * - Short TTL (3 seconds) for natural expiry
 * - Event-driven invalidation on WebSocket events (GOAL, SCORE_CHANGE, etc.)
 * - Match-specific invalidation for targeted cache busting
 * - Singleton pattern for global state consistency
 *
 * Phase 6: Performance optimization without sacrificing real-time accuracy
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveMatchCache = void 0;
var logger_1 = require("../../../utils/logger");
/**
 * Live Match Cache - Event-driven smart caching
 */
var LiveMatchCacheService = /** @class */ (function () {
    function LiveMatchCacheService() {
        // Cache storage
        // Cache storage
        this.liveMatchesCache = null;
        this.diaryCache = new Map();
        this.unifiedCache = new Map();
        this.genericCache = new Map(); // Generic cache for arbitrary data
        // TTL configuration (milliseconds)
        this.LIVE_MATCHES_TTL_MS = 3000; // 3 seconds for live matches
        this.DIARY_TTL_MS = 10000; // 10 seconds for diary (less volatile)
        this.UNIFIED_TTL_MS = 30000; // 30 seconds for unified (balances freshness with performance)
        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0,
            lastInvalidation: null,
        };
        // Invalidation tracking (for deduplication)
        this.recentInvalidations = new Map();
        this.INVALIDATION_DEDUP_MS = 500; // Dedupe invalidations within 500ms
    }
    /**
     * Get cached live matches
     * @returns Cached data if valid, null if cache miss/expired
     */
    LiveMatchCacheService.prototype.getLiveMatches = function () {
        if (!this.liveMatchesCache) {
            this.stats.misses++;
            return null;
        }
        var age = Date.now() - this.liveMatchesCache.timestamp;
        if (age > this.LIVE_MATCHES_TTL_MS) {
            // Expired
            this.liveMatchesCache = null;
            this.stats.misses++;
            return null;
        }
        // Cache hit
        this.liveMatchesCache.hitCount++;
        this.stats.hits++;
        logger_1.logger.debug("[LiveMatchCache] HIT - live matches (age: ".concat(age, "ms, hits: ").concat(this.liveMatchesCache.hitCount, ")"));
        return this.liveMatchesCache.data;
    };
    /**
     * Set live matches cache
     */
    LiveMatchCacheService.prototype.setLiveMatches = function (data) {
        var _a;
        this.liveMatchesCache = {
            data: data,
            timestamp: Date.now(),
            hitCount: 0,
        };
        logger_1.logger.debug("[LiveMatchCache] SET - live matches (".concat(((_a = data.results) === null || _a === void 0 ? void 0 : _a.length) || 0, " matches)"));
    };
    /**
     * Get cached diary matches for a date
     */
    LiveMatchCacheService.prototype.getDiary = function (date, statusFilter) {
        var key = this.buildDiaryKey(date, statusFilter);
        var entry = this.diaryCache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        var age = Date.now() - entry.timestamp;
        if (age > this.DIARY_TTL_MS) {
            this.diaryCache.delete(key);
            this.stats.misses++;
            return null;
        }
        entry.hitCount++;
        this.stats.hits++;
        logger_1.logger.debug("[LiveMatchCache] HIT - diary ".concat(key, " (age: ").concat(age, "ms)"));
        return entry.data;
    };
    /**
     * Set diary cache
     */
    LiveMatchCacheService.prototype.setDiary = function (date, statusFilter, data) {
        var _a;
        var key = this.buildDiaryKey(date, statusFilter);
        this.diaryCache.set(key, {
            data: data,
            timestamp: Date.now(),
            hitCount: 0,
        });
        logger_1.logger.debug("[LiveMatchCache] SET - diary ".concat(key, " (").concat(((_a = data.results) === null || _a === void 0 ? void 0 : _a.length) || 0, " matches)"));
    };
    /**
     * Get cached unified matches
     */
    LiveMatchCacheService.prototype.getUnified = function (date, includeLive) {
        var key = "".concat(date, ":").concat(includeLive);
        var entry = this.unifiedCache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        var age = Date.now() - entry.timestamp;
        if (age > this.UNIFIED_TTL_MS) {
            this.unifiedCache.delete(key);
            this.stats.misses++;
            return null;
        }
        entry.hitCount++;
        this.stats.hits++;
        logger_1.logger.debug("[LiveMatchCache] HIT - unified ".concat(key, " (age: ").concat(age, "ms)"));
        return entry.data;
    };
    /**
     * Set unified cache
     */
    LiveMatchCacheService.prototype.setUnified = function (date, includeLive, data) {
        var _a;
        var key = "".concat(date, ":").concat(includeLive);
        this.unifiedCache.set(key, {
            data: data,
            timestamp: Date.now(),
            hitCount: 0,
        });
        logger_1.logger.debug("[LiveMatchCache] SET - unified ".concat(key, " (").concat(((_a = data.results) === null || _a === void 0 ? void 0 : _a.length) || 0, " matches)"));
    };
    /**
     * Generic GET for arbitrary data (e.g., single match details)
     */
    LiveMatchCacheService.prototype.get = function (key) {
        var entry = this.genericCache.get(key);
        if (!entry) {
            // this.stats.misses++; // Don't pollute main stats with generic misses
            return null;
        }
        // Generic entries might have different TTLs, checking if expired requires context
        // For now, we rely on the set() method to handle expiration logic if we added it, 
        // but here we just return data. Wait, we need to know expiry.
        // Simplification: We assume caller checks TTL or we store TTL in entry?
        // Better: Allow set() to accept TTL, and check it here. But CacheEntry don't have TTL.
        // Let's just return for now and let caller decide, OR enforce a default TTL.
        // Actually, the original CacheEntry has timestamp. We just need to know the allowed max age.
        // Since we can't pass maxAge here comfortably without changing signature everywhere,
        // let's assume if it exists, it's valid, OR implement a set with explicit TTL stored in entry?
        // Let's stick to the interface:
        // The previous error was: "Property 'get' does not exist". 
        // So if we just add 'get(key)' and 'set(key, val, ttl)' it should work.
        // Check internal expiry if we store ttl in generic cache map?
        // Let's modify genericCache to store TTL too or just check age against a param?
        // To match the calling code: await liveMatchCache.set(match_id, result, 15);
        // The calling code passes Seconds as TTL.
        var now = Date.now();
        // We need to store TTL in the entry for generic cache to support variable TTLs
        if (entry.ttl && (now - entry.timestamp) > (entry.ttl * 1000)) {
            this.genericCache.delete(key);
            return null;
        }
        return entry.data;
    };
    /**
     * Generic SET for arbitrary data
     * @param ttlSeconds - Time into live in seconds
     */
    LiveMatchCacheService.prototype.set = function (key, data, ttlSeconds) {
        this.genericCache.set(key, {
            data: data,
            timestamp: Date.now(),
            hitCount: 0,
            ttl: ttlSeconds // Store TTL in the entry object (we cast to any above)
        });
    };
    /**
     * Invalidate cache for a specific match
     * Called when WebSocket event is received
     *
     * @param matchId - Match ID to invalidate
     * @param eventType - Type of event (for logging)
     */
    LiveMatchCacheService.prototype.invalidateMatch = function (matchId, eventType) {
        // Deduplication: Skip if recently invalidated
        var dedupKey = "".concat(matchId, ":").concat(eventType || 'unknown');
        var lastInvalidation = this.recentInvalidations.get(dedupKey);
        if (lastInvalidation && Date.now() - lastInvalidation < this.INVALIDATION_DEDUP_MS) {
            logger_1.logger.debug("[LiveMatchCache] SKIP invalidation (dedup) - ".concat(matchId, " ").concat(eventType));
            return;
        }
        // Record invalidation time
        this.recentInvalidations.set(dedupKey, Date.now());
        this.stats.invalidations++;
        this.stats.lastInvalidation = Date.now();
        // Invalidate live matches cache (primary)
        if (this.liveMatchesCache) {
            this.liveMatchesCache = null;
            logger_1.logger.debug("[LiveMatchCache] INVALIDATE - live matches (".concat(eventType, " on ").concat(matchId, ")"));
        }
        // Invalidate unified cache (all entries contain live data)
        if (this.unifiedCache.size > 0) {
            this.unifiedCache.clear();
            logger_1.logger.debug("[LiveMatchCache] INVALIDATE - unified cache cleared");
        }
        // Clean up old dedup entries periodically
        if (this.recentInvalidations.size > 1000) {
            this.cleanupDedupEntries();
        }
    };
    /**
     * Invalidate all caches
     * Used for major events or status changes
     */
    LiveMatchCacheService.prototype.invalidateAll = function () {
        this.liveMatchesCache = null;
        this.diaryCache.clear();
        this.unifiedCache.clear();
        this.stats.invalidations++;
        this.stats.lastInvalidation = Date.now();
        logger_1.logger.info("[LiveMatchCache] INVALIDATE ALL - all caches cleared");
    };
    /**
     * Get cache statistics
     */
    LiveMatchCacheService.prototype.getStats = function () {
        var total = this.stats.hits + this.stats.misses;
        return __assign(__assign({}, this.stats), { hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0, entriesCount: (this.liveMatchesCache ? 1 : 0) + this.diaryCache.size + this.unifiedCache.size });
    };
    /**
     * Reset statistics (for monitoring intervals)
     */
    LiveMatchCacheService.prototype.resetStats = function () {
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0,
            lastInvalidation: this.stats.lastInvalidation,
        };
    };
    // Private helpers
    LiveMatchCacheService.prototype.buildDiaryKey = function (date, statusFilter) {
        var statusPart = statusFilter ? ":".concat(statusFilter.sort().join(',')) : '';
        return "".concat(date).concat(statusPart);
    };
    LiveMatchCacheService.prototype.cleanupDedupEntries = function () {
        var now = Date.now();
        var cutoff = now - this.INVALIDATION_DEDUP_MS * 2;
        for (var _i = 0, _a = this.recentInvalidations; _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], timestamp = _b[1];
            if (timestamp < cutoff) {
                this.recentInvalidations.delete(key);
            }
        }
    };
    return LiveMatchCacheService;
}());
// Singleton export
exports.liveMatchCache = new LiveMatchCacheService();

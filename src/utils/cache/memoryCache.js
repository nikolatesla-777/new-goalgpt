"use strict";
/**
 * Memory Cache Service - Phase 5 Implementation
 *
 * High-performance, multi-tier in-memory cache for match data.
 * Designed for sports data platforms like FlashScore/SofaScore.
 *
 * Features:
 * - Separate caches for different data types (match, stats, lineup, etc.)
 * - TTL-based expiration with LRU-like eviction
 * - Hit/miss tracking for monitoring
 * - Type-safe API
 * - WebSocket invalidation support
 *
 * Performance targets:
 * - Cache hit: <1ms
 * - Cache miss: pass-through to database
 * - Memory limit: ~50MB max
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = exports.memoryCache = void 0;
var node_cache_1 = __importDefault(require("node-cache"));
var logger_1 = require("../logger");
/**
 * Cache configuration per data type
 * Tuned for sports data access patterns
 */
var CACHE_CONFIGS = {
    // Real-time data - very short TTL
    matchFull: {
        ttlSeconds: 10, // 10 seconds for full match data
        maxKeys: 200, // ~200 matches in memory
        checkPeriod: 5,
        description: 'Full match data (unified endpoint)',
    },
    liveScore: {
        ttlSeconds: 5, // 5 seconds for live scores
        maxKeys: 100, // Only live matches
        checkPeriod: 2,
        description: 'Live match scores',
    },
    incidents: {
        ttlSeconds: 5, // 5 seconds for incidents
        maxKeys: 200,
        checkPeriod: 2,
        description: 'Match incidents/events',
    },
    stats: {
        ttlSeconds: 30, // 30 seconds for stats
        maxKeys: 300,
        checkPeriod: 10,
        description: 'Match statistics',
    },
    // Semi-static data - medium TTL
    lineup: {
        ttlSeconds: 300, // 5 minutes
        maxKeys: 500,
        checkPeriod: 60,
        description: 'Match lineups',
    },
    h2h: {
        ttlSeconds: 300, // 5 minutes
        maxKeys: 500,
        checkPeriod: 60,
        description: 'Head-to-head data',
    },
    standings: {
        ttlSeconds: 300, // 5 minutes
        maxKeys: 100, // Per season
        checkPeriod: 60,
        description: 'League standings',
    },
    trend: {
        ttlSeconds: 60, // 1 minute
        maxKeys: 200,
        checkPeriod: 30,
        description: 'Match trend data',
    },
    // Static data - long TTL
    matchBasic: {
        ttlSeconds: 60, // 1 minute
        maxKeys: 1000,
        checkPeriod: 30,
        description: 'Basic match info',
    },
    team: {
        ttlSeconds: 3600, // 1 hour
        maxKeys: 5000,
        checkPeriod: 300,
        description: 'Team data',
    },
    competition: {
        ttlSeconds: 3600, // 1 hour
        maxKeys: 500,
        checkPeriod: 300,
        description: 'Competition/league data',
    },
    todayMatches: {
        ttlSeconds: 60, // 1 minute
        maxKeys: 10, // Just a few list caches
        checkPeriod: 30,
        description: 'Today\'s match list',
    },
    // AI Predictions data
    predictions: {
        ttlSeconds: 30, // 30 seconds (predictions don't change frequently)
        maxKeys: 500, // Per user/limit combinations
        checkPeriod: 10,
        description: 'AI Predictions matched list',
    },
};
// ============================================================
// MEMORY CACHE CLASS
// ============================================================
var MemoryCache = /** @class */ (function () {
    function MemoryCache() {
        this.caches = new Map();
        this.stats = new Map();
        this.initializeCaches();
        logger_1.logger.info('[MemoryCache] Initialized with configs:', Object.keys(CACHE_CONFIGS).join(', '));
    }
    /**
     * Initialize all cache instances
     */
    MemoryCache.prototype.initializeCaches = function () {
        var _loop_1 = function (name_1, config) {
            var cache = new node_cache_1.default({
                stdTTL: config.ttlSeconds,
                checkperiod: config.checkPeriod,
                maxKeys: config.maxKeys,
                useClones: false, // Performance: don't clone objects
                deleteOnExpire: true,
            });
            // Log eviction events
            cache.on('del', function (key, value) {
                logger_1.logger.debug("[MemoryCache:".concat(name_1, "] Key expired/deleted: ").concat(key));
            });
            this_1.caches.set(name_1, cache);
            this_1.stats.set(name_1, { hits: 0, misses: 0 });
        };
        var this_1 = this;
        for (var _i = 0, _a = Object.entries(CACHE_CONFIGS); _i < _a.length; _i++) {
            var _b = _a[_i], name_1 = _b[0], config = _b[1];
            _loop_1(name_1, config);
        }
    };
    /**
     * Get value from cache
     */
    MemoryCache.prototype.get = function (type, key) {
        var cache = this.caches.get(type);
        if (!cache) {
            logger_1.logger.warn("[MemoryCache] Unknown cache type: ".concat(type));
            return undefined;
        }
        var entry = cache.get(key);
        var stats = this.stats.get(type);
        if (entry) {
            stats.hits++;
            logger_1.logger.debug("[MemoryCache:".concat(type, "] HIT: ").concat(key, " (age: ").concat(Date.now() - entry.cachedAt, "ms)"));
            return entry.data;
        }
        stats.misses++;
        logger_1.logger.debug("[MemoryCache:".concat(type, "] MISS: ").concat(key));
        return undefined;
    };
    /**
     * Set value in cache with optional status-aware TTL
     */
    MemoryCache.prototype.set = function (type, key, data, statusId) {
        var cache = this.caches.get(type);
        if (!cache) {
            logger_1.logger.warn("[MemoryCache] Unknown cache type: ".concat(type));
            return false;
        }
        var entry = {
            data: data,
            cachedAt: Date.now(),
            statusId: statusId,
        };
        // Status-aware TTL for match data
        var ttl;
        if (statusId !== undefined && type === 'matchFull') {
            ttl = this.getTTLForStatus(statusId);
        }
        var success = ttl ? cache.set(key, entry, ttl) : cache.set(key, entry);
        if (success) {
            logger_1.logger.debug("[MemoryCache:".concat(type, "] SET: ").concat(key, " (ttl: ").concat(ttl || CACHE_CONFIGS[type].ttlSeconds, "s)"));
        }
        return success;
    };
    /**
     * Delete specific key from cache
     */
    MemoryCache.prototype.del = function (type, key) {
        var cache = this.caches.get(type);
        if (cache) {
            cache.del(key);
            logger_1.logger.debug("[MemoryCache:".concat(type, "] DEL: ").concat(key));
        }
    };
    /**
     * Invalidate all cache entries for a specific match
     * Called on WebSocket events (score change, incident, etc.)
     */
    MemoryCache.prototype.invalidateMatch = function (matchId) {
        var typesToInvalidate = [
            'matchFull',
            'liveScore',
            'incidents',
            'stats',
            'trend',
        ];
        for (var _i = 0, typesToInvalidate_1 = typesToInvalidate; _i < typesToInvalidate_1.length; _i++) {
            var type = typesToInvalidate_1[_i];
            this.del(type, matchId);
        }
        logger_1.logger.info("[MemoryCache] Invalidated match: ".concat(matchId));
    };
    /**
     * Invalidate standings cache for a season
     */
    MemoryCache.prototype.invalidateStandings = function (seasonId) {
        this.del('standings', seasonId);
        logger_1.logger.info("[MemoryCache] Invalidated standings: ".concat(seasonId));
    };
    /**
     * Clear all caches (for testing or emergency)
     */
    MemoryCache.prototype.clearAll = function () {
        for (var _i = 0, _a = this.caches; _i < _a.length; _i++) {
            var _b = _a[_i], name_2 = _b[0], cache = _b[1];
            cache.flushAll();
            this.stats.set(name_2, { hits: 0, misses: 0 });
        }
        logger_1.logger.warn('[MemoryCache] All caches cleared');
    };
    /**
     * Get cache statistics for monitoring
     */
    MemoryCache.prototype.getStats = function () {
        var result = {};
        for (var _i = 0, _a = this.caches; _i < _a.length; _i++) {
            var _b = _a[_i], name_3 = _b[0], cache = _b[1];
            var stats = this.stats.get(name_3);
            var keys = cache.keys().length;
            var total = stats.hits + stats.misses;
            result[name_3] = {
                hits: stats.hits,
                misses: stats.misses,
                keys: keys,
                hitRate: total > 0 ? Math.round((stats.hits / total) * 100) : 0,
            };
        }
        return result;
    };
    /**
     * Get detailed stats including memory usage estimate
     */
    MemoryCache.prototype.getDetailedStats = function () {
        var cacheStats = this.getStats();
        var result = {};
        var totalHits = 0;
        var totalMisses = 0;
        var totalKeys = 0;
        for (var _i = 0, _a = Object.entries(cacheStats); _i < _a.length; _i++) {
            var _b = _a[_i], name_4 = _b[0], stats = _b[1];
            result[name_4] = __assign(__assign({}, stats), { config: CACHE_CONFIGS[name_4] });
            totalHits += stats.hits;
            totalMisses += stats.misses;
            totalKeys += stats.keys;
        }
        var total = totalHits + totalMisses;
        // Rough memory estimate: ~2KB per cache entry average
        var memoryEstimateMB = Math.round((totalKeys * 2) / 1024 * 100) / 100;
        return {
            caches: result,
            totals: {
                hits: totalHits,
                misses: totalMisses,
                keys: totalKeys,
                hitRate: total > 0 ? Math.round((totalHits / total) * 100) : 0,
            },
            memoryEstimateMB: memoryEstimateMB,
        };
    };
    /**
     * Get TTL based on match status
     * Live matches get shorter TTL, finished matches get longer
     */
    MemoryCache.prototype.getTTLForStatus = function (statusId) {
        // Live statuses: 2 (1st half), 3 (halftime), 4 (2nd half), 5 (overtime), 7 (penalties)
        if ([2, 3, 4, 5, 7].includes(statusId)) {
            return 5; // 5 seconds for live matches
        }
        // Finished status: 8
        if (statusId === 8) {
            return 300; // 5 minutes for finished matches
        }
        // Not started (1) or other
        return 60; // 1 minute for upcoming matches
    };
    /**
     * Check if a specific key exists in cache
     */
    MemoryCache.prototype.has = function (type, key) {
        var cache = this.caches.get(type);
        return cache ? cache.has(key) : false;
    };
    /**
     * Get remaining TTL for a key in seconds
     */
    MemoryCache.prototype.getTtl = function (type, key) {
        var cache = this.caches.get(type);
        return cache === null || cache === void 0 ? void 0 : cache.getTtl(key);
    };
    return MemoryCache;
}());
// ============================================================
// SINGLETON EXPORT
// ============================================================
exports.memoryCache = new MemoryCache();
// ============================================================
// HELPER FUNCTIONS
// ============================================================
/**
 * Cache key generators for consistency
 */
exports.cacheKeys = {
    matchFull: function (matchId) { return matchId; },
    liveScore: function (matchId) { return matchId; },
    incidents: function (matchId) { return matchId; },
    stats: function (matchId) { return matchId; },
    lineup: function (matchId) { return matchId; },
    h2h: function (matchId) { return matchId; },
    standings: function (seasonId) { return seasonId; },
    trend: function (matchId) { return matchId; },
    matchBasic: function (matchId) { return matchId; },
    team: function (teamId) { return teamId; },
    competition: function (competitionId) { return competitionId; },
    todayMatches: function (date) { return date; },
    predictions: function (userId, limit) { return "".concat(userId || 'anon', ":").concat(limit); },
};

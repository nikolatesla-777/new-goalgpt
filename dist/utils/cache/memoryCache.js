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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = exports.memoryCache = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../logger");
/**
 * Cache configuration per data type
 * Tuned for sports data access patterns
 */
const CACHE_CONFIGS = {
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
class MemoryCache {
    constructor() {
        this.caches = new Map();
        this.stats = new Map();
        this.initializeCaches();
        logger_1.logger.info('[MemoryCache] Initialized with configs:', Object.keys(CACHE_CONFIGS).join(', '));
    }
    /**
     * Initialize all cache instances
     */
    initializeCaches() {
        for (const [name, config] of Object.entries(CACHE_CONFIGS)) {
            const cache = new node_cache_1.default({
                stdTTL: config.ttlSeconds,
                checkperiod: config.checkPeriod,
                maxKeys: config.maxKeys,
                useClones: false, // Performance: don't clone objects
                deleteOnExpire: true,
            });
            // Log eviction events
            cache.on('del', (key, value) => {
                logger_1.logger.debug(`[MemoryCache:${name}] Key expired/deleted: ${key}`);
            });
            this.caches.set(name, cache);
            this.stats.set(name, { hits: 0, misses: 0 });
        }
    }
    /**
     * Get value from cache
     */
    get(type, key) {
        const cache = this.caches.get(type);
        if (!cache) {
            logger_1.logger.warn(`[MemoryCache] Unknown cache type: ${type}`);
            return undefined;
        }
        const entry = cache.get(key);
        const stats = this.stats.get(type);
        if (entry) {
            stats.hits++;
            logger_1.logger.debug(`[MemoryCache:${type}] HIT: ${key} (age: ${Date.now() - entry.cachedAt}ms)`);
            return entry.data;
        }
        stats.misses++;
        logger_1.logger.debug(`[MemoryCache:${type}] MISS: ${key}`);
        return undefined;
    }
    /**
     * Set value in cache with optional status-aware TTL
     */
    set(type, key, data, statusId) {
        const cache = this.caches.get(type);
        if (!cache) {
            logger_1.logger.warn(`[MemoryCache] Unknown cache type: ${type}`);
            return false;
        }
        const entry = {
            data,
            cachedAt: Date.now(),
            statusId,
        };
        // Status-aware TTL for match data
        let ttl;
        if (statusId !== undefined && type === 'matchFull') {
            ttl = this.getTTLForStatus(statusId);
        }
        const success = ttl ? cache.set(key, entry, ttl) : cache.set(key, entry);
        if (success) {
            logger_1.logger.debug(`[MemoryCache:${type}] SET: ${key} (ttl: ${ttl || CACHE_CONFIGS[type].ttlSeconds}s)`);
        }
        return success;
    }
    /**
     * Delete specific key from cache
     */
    del(type, key) {
        const cache = this.caches.get(type);
        if (cache) {
            cache.del(key);
            logger_1.logger.debug(`[MemoryCache:${type}] DEL: ${key}`);
        }
    }
    /**
     * Invalidate all cache entries for a specific match
     * Called on WebSocket events (score change, incident, etc.)
     */
    invalidateMatch(matchId) {
        const typesToInvalidate = [
            'matchFull',
            'liveScore',
            'incidents',
            'stats',
            'trend',
        ];
        for (const type of typesToInvalidate) {
            this.del(type, matchId);
        }
        logger_1.logger.info(`[MemoryCache] Invalidated match: ${matchId}`);
    }
    /**
     * Invalidate standings cache for a season
     */
    invalidateStandings(seasonId) {
        this.del('standings', seasonId);
        logger_1.logger.info(`[MemoryCache] Invalidated standings: ${seasonId}`);
    }
    /**
     * Clear all caches (for testing or emergency)
     */
    clearAll() {
        for (const [name, cache] of this.caches) {
            cache.flushAll();
            this.stats.set(name, { hits: 0, misses: 0 });
        }
        logger_1.logger.warn('[MemoryCache] All caches cleared');
    }
    /**
     * Get cache statistics for monitoring
     */
    getStats() {
        const result = {};
        for (const [name, cache] of this.caches) {
            const stats = this.stats.get(name);
            const keys = cache.keys().length;
            const total = stats.hits + stats.misses;
            result[name] = {
                hits: stats.hits,
                misses: stats.misses,
                keys,
                hitRate: total > 0 ? Math.round((stats.hits / total) * 100) : 0,
            };
        }
        return result;
    }
    /**
     * Get detailed stats including memory usage estimate
     */
    getDetailedStats() {
        const cacheStats = this.getStats();
        const result = {};
        let totalHits = 0;
        let totalMisses = 0;
        let totalKeys = 0;
        for (const [name, stats] of Object.entries(cacheStats)) {
            result[name] = {
                ...stats,
                config: CACHE_CONFIGS[name],
            };
            totalHits += stats.hits;
            totalMisses += stats.misses;
            totalKeys += stats.keys;
        }
        const total = totalHits + totalMisses;
        // Rough memory estimate: ~2KB per cache entry average
        const memoryEstimateMB = Math.round((totalKeys * 2) / 1024 * 100) / 100;
        return {
            caches: result,
            totals: {
                hits: totalHits,
                misses: totalMisses,
                keys: totalKeys,
                hitRate: total > 0 ? Math.round((totalHits / total) * 100) : 0,
            },
            memoryEstimateMB,
        };
    }
    /**
     * Get TTL based on match status
     * Live matches get shorter TTL, finished matches get longer
     */
    getTTLForStatus(statusId) {
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
    }
    /**
     * Check if a specific key exists in cache
     */
    has(type, key) {
        const cache = this.caches.get(type);
        return cache ? cache.has(key) : false;
    }
    /**
     * Get remaining TTL for a key in seconds
     */
    getTtl(type, key) {
        const cache = this.caches.get(type);
        return cache?.getTtl(key);
    }
}
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
    matchFull: (matchId) => matchId,
    liveScore: (matchId) => matchId,
    incidents: (matchId) => matchId,
    stats: (matchId) => matchId,
    lineup: (matchId) => matchId,
    h2h: (matchId) => matchId,
    standings: (seasonId) => seasonId,
    trend: (matchId) => matchId,
    matchBasic: (matchId) => matchId,
    team: (teamId) => teamId,
    competition: (competitionId) => competitionId,
    todayMatches: (date) => date,
    predictions: (userId, limit) => `${userId || 'anon'}:${limit}`,
};

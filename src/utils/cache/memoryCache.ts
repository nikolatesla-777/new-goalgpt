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

import NodeCache from 'node-cache';
import { logger } from '../logger';

// ============================================================
// CACHE CONFIGURATION
// ============================================================

interface CacheConfig {
  /** Time to live in seconds */
  ttlSeconds: number;
  /** Maximum number of entries (LRU eviction when exceeded) */
  maxKeys: number;
  /** Check period for expired keys (seconds) */
  checkPeriod: number;
  /** Description for logging */
  description: string;
}

/**
 * Cache configuration per data type
 * Tuned for sports data access patterns
 */
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Real-time data - very short TTL
  matchFull: {
    ttlSeconds: 10,        // 10 seconds for full match data
    maxKeys: 200,          // ~200 matches in memory
    checkPeriod: 5,
    description: 'Full match data (unified endpoint)',
  },
  liveScore: {
    ttlSeconds: 5,         // 5 seconds for live scores
    maxKeys: 100,          // Only live matches
    checkPeriod: 2,
    description: 'Live match scores',
  },
  incidents: {
    ttlSeconds: 5,         // 5 seconds for incidents
    maxKeys: 200,
    checkPeriod: 2,
    description: 'Match incidents/events',
  },
  stats: {
    ttlSeconds: 30,        // 30 seconds for stats
    maxKeys: 300,
    checkPeriod: 10,
    description: 'Match statistics',
  },

  // Semi-static data - medium TTL
  lineup: {
    ttlSeconds: 300,       // 5 minutes
    maxKeys: 500,
    checkPeriod: 60,
    description: 'Match lineups',
  },
  h2h: {
    ttlSeconds: 300,       // 5 minutes
    maxKeys: 500,
    checkPeriod: 60,
    description: 'Head-to-head data',
  },
  standings: {
    ttlSeconds: 300,       // 5 minutes
    maxKeys: 100,          // Per season
    checkPeriod: 60,
    description: 'League standings',
  },
  trend: {
    ttlSeconds: 60,        // 1 minute
    maxKeys: 200,
    checkPeriod: 30,
    description: 'Match trend data',
  },

  // Static data - long TTL
  matchBasic: {
    ttlSeconds: 60,        // 1 minute
    maxKeys: 1000,
    checkPeriod: 30,
    description: 'Basic match info',
  },
  team: {
    ttlSeconds: 3600,      // 1 hour
    maxKeys: 5000,
    checkPeriod: 300,
    description: 'Team data',
  },
  competition: {
    ttlSeconds: 3600,      // 1 hour
    maxKeys: 500,
    checkPeriod: 300,
    description: 'Competition/league data',
  },
  todayMatches: {
    ttlSeconds: 60,        // 1 minute
    maxKeys: 10,           // Just a few list caches
    checkPeriod: 30,
    description: 'Today\'s match list',
  },

  // AI Predictions data
  predictions: {
    ttlSeconds: 30,        // 30 seconds (predictions don't change frequently)
    maxKeys: 500,          // Per user/limit combinations
    checkPeriod: 10,
    description: 'AI Predictions matched list',
  },
};

// ============================================================
// CACHE TYPES
// ============================================================

export type CacheType = keyof typeof CACHE_CONFIGS;

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  statusId?: number;  // For match status-aware TTL
}

// ============================================================
// MEMORY CACHE CLASS
// ============================================================

class MemoryCache {
  private caches: Map<string, NodeCache> = new Map();
  private stats: Map<string, { hits: number; misses: number }> = new Map();

  constructor() {
    this.initializeCaches();
    logger.info('[MemoryCache] Initialized with configs:', Object.keys(CACHE_CONFIGS).join(', '));
  }

  /**
   * Initialize all cache instances
   */
  private initializeCaches(): void {
    for (const [name, config] of Object.entries(CACHE_CONFIGS)) {
      const cache = new NodeCache({
        stdTTL: config.ttlSeconds,
        checkperiod: config.checkPeriod,
        maxKeys: config.maxKeys,
        useClones: false,  // Performance: don't clone objects
        deleteOnExpire: true,
      });

      // Log eviction events
      cache.on('del', (key, value) => {
        logger.debug(`[MemoryCache:${name}] Key expired/deleted: ${key}`);
      });

      this.caches.set(name, cache);
      this.stats.set(name, { hits: 0, misses: 0 });
    }
  }

  /**
   * Get value from cache
   */
  get<T>(type: CacheType, key: string): T | undefined {
    const cache = this.caches.get(type);
    if (!cache) {
      logger.warn(`[MemoryCache] Unknown cache type: ${type}`);
      return undefined;
    }

    const entry = cache.get<CacheEntry<T>>(key);
    const stats = this.stats.get(type)!;

    if (entry) {
      stats.hits++;
      logger.debug(`[MemoryCache:${type}] HIT: ${key} (age: ${Date.now() - entry.cachedAt}ms)`);
      return entry.data;
    }

    stats.misses++;
    logger.debug(`[MemoryCache:${type}] MISS: ${key}`);
    return undefined;
  }

  /**
   * Set value in cache with optional status-aware TTL
   */
  set<T>(type: CacheType, key: string, data: T, statusId?: number): boolean {
    const cache = this.caches.get(type);
    if (!cache) {
      logger.warn(`[MemoryCache] Unknown cache type: ${type}`);
      return false;
    }

    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      statusId,
    };

    // Status-aware TTL for match data
    let ttl: number | undefined;
    if (statusId !== undefined && type === 'matchFull') {
      ttl = this.getTTLForStatus(statusId);
    }

    const success = ttl ? cache.set(key, entry, ttl) : cache.set(key, entry);

    if (success) {
      logger.debug(`[MemoryCache:${type}] SET: ${key} (ttl: ${ttl || CACHE_CONFIGS[type].ttlSeconds}s)`);
    }

    return success;
  }

  /**
   * Delete specific key from cache
   */
  del(type: CacheType, key: string): void {
    const cache = this.caches.get(type);
    if (cache) {
      cache.del(key);
      logger.debug(`[MemoryCache:${type}] DEL: ${key}`);
    }
  }

  /**
   * Invalidate all cache entries for a specific match
   * Called on WebSocket events (score change, incident, etc.)
   */
  invalidateMatch(matchId: string): void {
    const typesToInvalidate: CacheType[] = [
      'matchFull',
      'liveScore',
      'incidents',
      'stats',
      'trend',
    ];

    for (const type of typesToInvalidate) {
      this.del(type, matchId);
    }

    logger.info(`[MemoryCache] Invalidated match: ${matchId}`);
  }

  /**
   * Invalidate standings cache for a season
   */
  invalidateStandings(seasonId: string): void {
    this.del('standings', seasonId);
    logger.info(`[MemoryCache] Invalidated standings: ${seasonId}`);
  }

  /**
   * Clear all caches (for testing or emergency)
   */
  clearAll(): void {
    for (const [name, cache] of this.caches) {
      cache.flushAll();
      this.stats.set(name, { hits: 0, misses: 0 });
    }
    logger.warn('[MemoryCache] All caches cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};

    for (const [name, cache] of this.caches) {
      const stats = this.stats.get(name)!;
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
  getDetailedStats(): {
    caches: Record<string, CacheStats & { config: CacheConfig }>;
    totals: { hits: number; misses: number; keys: number; hitRate: number };
    memoryEstimateMB: number;
  } {
    const cacheStats = this.getStats();
    const result: Record<string, CacheStats & { config: CacheConfig }> = {};

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
  private getTTLForStatus(statusId: number): number {
    // Live statuses: 2 (1st half), 3 (halftime), 4 (2nd half), 5 (overtime), 7 (penalties)
    if ([2, 3, 4, 5, 7].includes(statusId)) {
      return 5;  // 5 seconds for live matches
    }

    // Finished status: 8
    if (statusId === 8) {
      return 300;  // 5 minutes for finished matches
    }

    // Not started (1) or other
    return 60;  // 1 minute for upcoming matches
  }

  /**
   * Check if a specific key exists in cache
   */
  has(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type);
    return cache ? cache.has(key) : false;
  }

  /**
   * Get remaining TTL for a key in seconds
   */
  getTtl(type: CacheType, key: string): number | undefined {
    const cache = this.caches.get(type);
    return cache?.getTtl(key);
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const memoryCache = new MemoryCache();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Cache key generators for consistency
 */
export const cacheKeys = {
  matchFull: (matchId: string) => matchId,
  liveScore: (matchId: string) => matchId,
  incidents: (matchId: string) => matchId,
  stats: (matchId: string) => matchId,
  lineup: (matchId: string) => matchId,
  h2h: (matchId: string) => matchId,
  standings: (seasonId: string) => seasonId,
  trend: (matchId: string) => matchId,
  matchBasic: (matchId: string) => matchId,
  team: (teamId: string) => teamId,
  competition: (competitionId: string) => competitionId,
  todayMatches: (date: string) => date,
  predictions: (userId: string | undefined, limit: number) => `${userId || 'anon'}:${limit}`,
};

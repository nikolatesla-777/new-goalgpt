
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

import { logger } from '../../../utils/logger';
import { MatchDiaryResponse } from '../../../types/thesports/match';

/**
 * Cache entry with timestamp for TTL management
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hitCount: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  hitRate: number;
  lastInvalidation: number | null;
  entriesCount: number;
}

/**
 * Live Match Cache - Event-driven smart caching
 */
class LiveMatchCacheService {
  // Cache storage
  private liveMatchesCache: CacheEntry<MatchDiaryResponse> | null = null;
  private diaryCache: Map<string, CacheEntry<MatchDiaryResponse>> = new Map();
  private unifiedCache: Map<string, CacheEntry<MatchDiaryResponse>> = new Map();

  // TTL configuration (milliseconds)
  private readonly LIVE_MATCHES_TTL_MS = 3000;    // 3 seconds for live matches
  private readonly DIARY_TTL_MS = 10000;          // 10 seconds for diary (less volatile)
  private readonly UNIFIED_TTL_MS = 3000;         // 3 seconds for unified (includes live)

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    lastInvalidation: null as number | null,
  };

  // Invalidation tracking (for deduplication)
  private recentInvalidations: Map<string, number> = new Map();
  private readonly INVALIDATION_DEDUP_MS = 500; // Dedupe invalidations within 500ms

  /**
   * Get cached live matches
   * @returns Cached data if valid, null if cache miss/expired
   */
  getLiveMatches(): MatchDiaryResponse | null {
    if (!this.liveMatchesCache) {
      this.stats.misses++;
      return null;
    }

    const age = Date.now() - this.liveMatchesCache.timestamp;
    if (age > this.LIVE_MATCHES_TTL_MS) {
      // Expired
      this.liveMatchesCache = null;
      this.stats.misses++;
      return null;
    }

    // Cache hit
    this.liveMatchesCache.hitCount++;
    this.stats.hits++;
    logger.debug(`[LiveMatchCache] HIT - live matches (age: ${age}ms, hits: ${this.liveMatchesCache.hitCount})`);
    return this.liveMatchesCache.data;
  }

  /**
   * Set live matches cache
   */
  setLiveMatches(data: MatchDiaryResponse): void {
    this.liveMatchesCache = {
      data,
      timestamp: Date.now(),
      hitCount: 0,
    };
    logger.debug(`[LiveMatchCache] SET - live matches (${data.results?.length || 0} matches)`);
  }

  /**
   * Get cached diary matches for a date
   */
  getDiary(date: string, statusFilter?: number[]): MatchDiaryResponse | null {
    const key = this.buildDiaryKey(date, statusFilter);
    const entry = this.diaryCache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.DIARY_TTL_MS) {
      this.diaryCache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hitCount++;
    this.stats.hits++;
    logger.debug(`[LiveMatchCache] HIT - diary ${key} (age: ${age}ms)`);
    return entry.data;
  }

  /**
   * Set diary cache
   */
  setDiary(date: string, statusFilter: number[] | undefined, data: MatchDiaryResponse): void {
    const key = this.buildDiaryKey(date, statusFilter);
    this.diaryCache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0,
    });
    logger.debug(`[LiveMatchCache] SET - diary ${key} (${data.results?.length || 0} matches)`);
  }

  /**
   * Get cached unified matches
   */
  getUnified(date: string, includeLive: boolean): MatchDiaryResponse | null {
    const key = `${date}:${includeLive}`;
    const entry = this.unifiedCache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.UNIFIED_TTL_MS) {
      this.unifiedCache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hitCount++;
    this.stats.hits++;
    logger.debug(`[LiveMatchCache] HIT - unified ${key} (age: ${age}ms)`);
    return entry.data;
  }

  /**
   * Set unified cache
   */
  setUnified(date: string, includeLive: boolean, data: MatchDiaryResponse): void {
    const key = `${date}:${includeLive}`;
    this.unifiedCache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0,
    });
    logger.debug(`[LiveMatchCache] SET - unified ${key} (${data.results?.length || 0} matches)`);
  }

  /**
   * Invalidate cache for a specific match
   * Called when WebSocket event is received
   *
   * @param matchId - Match ID to invalidate
   * @param eventType - Type of event (for logging)
   */
  invalidateMatch(matchId: string, eventType?: string): void {
    // Deduplication: Skip if recently invalidated
    const dedupKey = `${matchId}:${eventType || 'unknown'}`;
    const lastInvalidation = this.recentInvalidations.get(dedupKey);
    if (lastInvalidation && Date.now() - lastInvalidation < this.INVALIDATION_DEDUP_MS) {
      logger.debug(`[LiveMatchCache] SKIP invalidation (dedup) - ${matchId} ${eventType}`);
      return;
    }

    // Record invalidation time
    this.recentInvalidations.set(dedupKey, Date.now());
    this.stats.invalidations++;
    this.stats.lastInvalidation = Date.now();

    // Invalidate live matches cache (primary)
    if (this.liveMatchesCache) {
      this.liveMatchesCache = null;
      logger.debug(`[LiveMatchCache] INVALIDATE - live matches (${eventType} on ${matchId})`);
    }

    // Invalidate unified cache (all entries contain live data)
    if (this.unifiedCache.size > 0) {
      this.unifiedCache.clear();
      logger.debug(`[LiveMatchCache] INVALIDATE - unified cache cleared`);
    }

    // Clean up old dedup entries periodically
    if (this.recentInvalidations.size > 1000) {
      this.cleanupDedupEntries();
    }
  }

  /**
   * Invalidate all caches
   * Used for major events or status changes
   */
  invalidateAll(): void {
    this.liveMatchesCache = null;
    this.diaryCache.clear();
    this.unifiedCache.clear();
    this.stats.invalidations++;
    this.stats.lastInvalidation = Date.now();
    logger.info(`[LiveMatchCache] INVALIDATE ALL - all caches cleared`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
      entriesCount: (this.liveMatchesCache ? 1 : 0) + this.diaryCache.size + this.unifiedCache.size,
    };
  }

  /**
   * Reset statistics (for monitoring intervals)
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      lastInvalidation: this.stats.lastInvalidation,
    };
  }

  // Private helpers

  private buildDiaryKey(date: string, statusFilter?: number[]): string {
    const statusPart = statusFilter ? `:${statusFilter.sort().join(',')}` : '';
    return `${date}${statusPart}`;
  }

  private cleanupDedupEntries(): void {
    const now = Date.now();
    const cutoff = now - this.INVALIDATION_DEDUP_MS * 2;
    for (const [key, timestamp] of this.recentInvalidations) {
      if (timestamp < cutoff) {
        this.recentInvalidations.delete(key);
      }
    }
  }
}

// Singleton export
export const liveMatchCache = new LiveMatchCacheService();

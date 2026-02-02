import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis Cache Utility
 *
 * Provides a simple interface for caching with Redis:
 * - getOrFetch: Cache-aside pattern with automatic TTL
 * - invalidate: Manual cache invalidation
 * - clear: Clear all cache (use with caution)
 *
 * Usage:
 * ```typescript
 * const cache = new RedisCache();
 * const standings = await cache.getOrFetch(
 *   'standings:39',
 *   300,  // 5 minutes
 *   () => standingsService.getLeagueStandings(39)
 * );
 * ```
 */
export class RedisCache {
  private redis: Redis;
  private prefix: string;

  constructor(redisUrl?: string, prefix: string = 'goalgpt:') {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.prefix = prefix;

    this.redis.on('error', (error) => {
      logger.error('[RedisCache] Connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('[RedisCache] Connected to Redis');
    });
  }

  /**
   * Get or fetch data with caching
   *
   * If key exists in cache, return cached value
   * Otherwise, call fetchFn, cache the result, and return it
   *
   * @param key - Cache key (will be prefixed)
   * @param ttl - Time to live in seconds
   * @param fetchFn - Function to fetch data if not in cache
   * @returns Cached or fresh data
   */
  async getOrFetch<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
  ): Promise<{ data: T; fromCache: boolean }> {
    const prefixedKey = `${this.prefix}${key}`;

    try {
      // Try to get from cache
      const cached = await this.redis.get(prefixedKey);
      if (cached) {
        logger.debug(`[RedisCache] Cache HIT: ${key}`);
        return {
          data: JSON.parse(cached) as T,
          fromCache: true,
        };
      }

      logger.debug(`[RedisCache] Cache MISS: ${key}`);

      // Fetch fresh data
      const data = await fetchFn();

      // Cache the result
      await this.redis.setex(prefixedKey, ttl, JSON.stringify(data));

      return {
        data,
        fromCache: false,
      };
    } catch (error: any) {
      logger.error(`[RedisCache] Error for key ${key}:`, error.message);

      // Fallback: fetch without caching
      const data = await fetchFn();
      return {
        data,
        fromCache: false,
      };
    }
  }

  /**
   * Invalidate (delete) a cache entry
   *
   * @param key - Cache key to invalidate
   */
  async invalidate(key: string): Promise<void> {
    const prefixedKey = `${this.prefix}${key}`;
    try {
      await this.redis.del(prefixedKey);
      logger.debug(`[RedisCache] Invalidated: ${key}`);
    } catch (error: any) {
      logger.error(`[RedisCache] Failed to invalidate ${key}:`, error.message);
    }
  }

  /**
   * Invalidate multiple cache entries by pattern
   *
   * WARNING: SCAN operation, use with caution
   *
   * @param pattern - Key pattern (e.g., "standings:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const prefixedPattern = `${this.prefix}${pattern}`;
    try {
      const keys = await this.redis.keys(prefixedPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug(`[RedisCache] Invalidated ${keys.length} keys matching: ${pattern}`);
      }
    } catch (error: any) {
      logger.error(`[RedisCache] Failed to invalidate pattern ${pattern}:`, error.message);
    }
  }

  /**
   * Clear all cache entries with this prefix
   *
   * WARNING: Destructive operation, use with extreme caution
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.warn(`[RedisCache] Cleared ${keys.length} cache entries`);
      }
    } catch (error: any) {
      logger.error('[RedisCache] Failed to clear cache:', error.message);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Redis info (memory usage, hit rate, etc.)
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');

      return {
        info,
        keyspace,
      };
    } catch (error: any) {
      logger.error('[RedisCache] Failed to get stats:', error.message);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    logger.info('[RedisCache] Disconnected from Redis');
  }
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

/**
 * Get singleton cache instance
 *
 * @returns RedisCache instance
 */
export function getCache(): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache();
  }
  return cacheInstance;
}

/**
 * Cache TTL constants (in seconds)
 */
export const CACHE_TTL = {
  STANDINGS: 300,        // 5 minutes (standings update frequently)
  H2H: 3600,             // 1 hour (historical data, rarely changes)
  MATCH_DETAILS: 30,     // 30 seconds (live matches need fresh data)
  TEAM_INFO: 86400,      // 24 hours (team info rarely changes)
  LEAGUE_INFO: 86400,    // 24 hours (league info rarely changes)
  PLAYER_INFO: 86400,    // 24 hours (player info rarely changes)
} as const;

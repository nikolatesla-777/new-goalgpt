/**
 * Cache Service
 * 
 * Simple in-memory cache implementation
 * TODO: Add Redis support in the future
 */

import { CacheTTL } from './types';
import { logger } from '../logger';

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl: CacheTTL = CacheTTL.Hour): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
    logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    this.cache.delete(key);
    logger.debug(`Cache deleted: ${key}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

export const cacheService = new CacheService();

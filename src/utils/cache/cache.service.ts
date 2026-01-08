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
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start active cleanup on instantiation (Phase 2 Fix)
    this.startCleanup();
  }

  /**
   * Start background cleanup task
   * Runs every 60 seconds to remove expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 60 seconds

    // Prevent Node.js from keeping process alive just for this
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }

    logger.info('[Cache] Active cleanup started (60s interval)');
  }

  /**
   * Clean up expired entries
   * Called automatically every 60 seconds
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`[Cache] Cleanup: removed ${removed} expired entries (${this.cache.size} remaining)`);
    }
  }

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

  /**
   * Stop cleanup (for graceful shutdown)
   * Call this during application shutdown
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('[Cache] Active cleanup stopped');
    }
  }
}

export const cacheService = new CacheService();

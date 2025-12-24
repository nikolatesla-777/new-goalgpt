/**
 * Cache Fallback Utility
 * 
 * Implements stale-while-revalidate pattern for API failure scenarios
 */

import { cacheService } from './cache.service';
import { CacheTTL } from './types';
import { logger } from '../logger';

export interface CacheFallbackOptions {
  cacheKey: string;
  ttl: CacheTTL;
  staleTtl: CacheTTL; // How long to serve stale data
}

/**
 * Get data with cache fallback
 * Returns stale data if available when API fails
 */
export async function getWithCacheFallback<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: Partial<CacheFallbackOptions> = {}
): Promise<T> {
  const { ttl = CacheTTL.FiveMinutes, staleTtl = CacheTTL.Day } = options;

  try {
    // Try to fetch fresh data
    const freshData = await fetchFn();
    
    // Cache fresh data
    await cacheService.set(cacheKey, freshData, ttl);
    
    return freshData;
  } catch (error: any) {
    logger.warn(`API fetch failed, attempting cache fallback: ${cacheKey}`, error);

    // Try to get stale data from cache
    const staleData = await cacheService.get<T>(cacheKey);
    
    if (staleData) {
      logger.info(`Serving stale data from cache: ${cacheKey}`);
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
export async function staleWhileRevalidate<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: Partial<CacheFallbackOptions> = {}
): Promise<T> {
  const { ttl = CacheTTL.FiveMinutes } = options;

  // Get cached data immediately
  const cached = await cacheService.get<T>(cacheKey);
  
  if (cached) {
    // Refresh in background (fire and forget)
    fetchFn()
      .then((freshData) => {
        cacheService.set(cacheKey, freshData, ttl);
        logger.debug(`Background refresh completed: ${cacheKey}`);
      })
      .catch((error) => {
        logger.warn(`Background refresh failed: ${cacheKey}`, error);
      });

    return cached;
  }

  // No cache, fetch fresh data
  const freshData = await fetchFn();
  await cacheService.set(cacheKey, freshData, ttl);
  return freshData;
}


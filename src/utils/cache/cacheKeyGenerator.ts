/**
 * Cache Key Generator Utilities
 *
 * Provides collision-resistant, deterministic cache key generation.
 * Used across the application for consistent cache key creation.
 */

import * as crypto from 'crypto';

/**
 * Generate deterministic cache key from query params
 *
 * Features:
 * - Order-independent: Sorts keys before hashing
 * - Excludes volatile params: Skips null/undefined values
 * - Collision-resistant: MD5 hash of normalized params
 * - Future-proof: New params automatically included
 *
 * @param queryParams - Object containing query parameters
 * @returns Cache key in format: "prefix:hash"
 *
 * @example
 * generatePredictionsCacheKey({ userId: '123', limit: 50 })
 * // → "matched:a1b2c3d4e5f6"
 *
 * generatePredictionsCacheKey({ limit: 50, userId: '123' })
 * // → "matched:a1b2c3d4e5f6" (same key, different order)
 */
export function generatePredictionsCacheKey(queryParams: Record<string, any>): string {
  // Sort keys to ensure deterministic hash
  const sortedKeys = Object.keys(queryParams).sort();
  const normalized: Record<string, any> = {};

  for (const key of sortedKeys) {
    const value = queryParams[key];
    // Skip undefined/null values (volatile params)
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }

  const paramsString = JSON.stringify(normalized);
  const hash = crypto.createHash('md5').update(paramsString).digest('hex').substring(0, 12);
  return `matched:${hash}`;
}

/**
 * Generate cache key for generic resources
 *
 * @param prefix - Cache key prefix (e.g., 'match', 'team')
 * @param params - Parameters to hash
 * @returns Cache key in format: "prefix:hash"
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const normalized: Record<string, any> = {};

  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }

  const paramsString = JSON.stringify(normalized);
  const hash = crypto.createHash('md5').update(paramsString).digest('hex').substring(0, 12);
  return `${prefix}:${hash}`;
}

/**
 * Extract params from cache key (for debugging)
 *
 * Note: This is a one-way hash, so params cannot be recovered.
 * This function is for logging/debugging purposes only.
 *
 * @param cacheKey - Cache key in format "prefix:hash"
 * @returns Object with prefix and hash
 */
export function parseCacheKey(cacheKey: string): { prefix: string; hash: string } {
  const parts = cacheKey.split(':');
  return {
    prefix: parts[0],
    hash: parts[1] || '',
  };
}

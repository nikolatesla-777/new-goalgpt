/**
 * Match Data Cache Utility
 *
 * Simple but effective client-side caching with stale-while-revalidate pattern.
 * Uses localStorage for persistence across sessions.
 *
 * Performance targets:
 * - Cache hit: <10ms (instant UI)
 * - Cache miss: ~2s (API call)
 * - Stale data shown instantly, fresh data loaded in background
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  matchId: string;
}

// TTL constants (in milliseconds)
const CACHE_TTL = {
  // Live matches: 30 seconds (data changes frequently)
  LIVE: 30 * 1000,
  // Finished matches: 1 hour (data rarely changes)
  FINISHED: 60 * 60 * 1000,
  // Not started matches: 5 minutes (lineup might update)
  NOT_STARTED: 5 * 60 * 1000,
};

// Maximum cache entries to prevent localStorage bloat
const MAX_CACHE_ENTRIES = 50;

const CACHE_KEY_PREFIX = 'goalgpt:match:';

/**
 * Get cached match data
 * Returns { data, isStale } or null if not cached
 */
export function getMatchCache(matchId: string, statusId?: number): { data: any; isStale: boolean } | null {
  try {
    const key = CACHE_KEY_PREFIX + matchId;
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const entry: CacheEntry<any> = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    // Determine TTL based on match status
    const ttl = getTTL(statusId);
    const isStale = age > ttl;

    return { data: entry.data, isStale };
  } catch {
    return null;
  }
}

/**
 * Set cached match data
 */
export function setMatchCache(matchId: string, data: any): void {
  try {
    const key = CACHE_KEY_PREFIX + matchId;
    const entry: CacheEntry<any> = {
      data,
      timestamp: Date.now(),
      matchId,
    };

    localStorage.setItem(key, JSON.stringify(entry));

    // Cleanup old entries if we have too many
    cleanupCache();
  } catch (e) {
    // localStorage might be full or disabled
    console.warn('[MatchCache] Failed to cache:', e);
  }
}

/**
 * Clear cache for a specific match
 */
export function clearMatchCache(matchId: string): void {
  try {
    localStorage.removeItem(CACHE_KEY_PREFIX + matchId);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all match cache
 */
export function clearAllMatchCache(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // Ignore errors
  }
}

/**
 * Get TTL based on match status
 */
function getTTL(statusId?: number): number {
  if (!statusId) return CACHE_TTL.NOT_STARTED;

  // Live statuses: 2 (1st half), 3 (halftime), 4 (2nd half), 5 (overtime), 7 (penalties)
  if ([2, 3, 4, 5, 7].includes(statusId)) {
    return CACHE_TTL.LIVE;
  }

  // Finished status: 8
  if (statusId === 8) {
    return CACHE_TTL.FINISHED;
  }

  // Not started (1) or other statuses
  return CACHE_TTL.NOT_STARTED;
}

/**
 * Cleanup old cache entries if we have too many
 * Keeps the most recently accessed entries
 */
function cleanupCache(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));

    if (keys.length <= MAX_CACHE_ENTRIES) return;

    // Get all entries with timestamps
    const entries = keys.map(key => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const entry: CacheEntry<any> = JSON.parse(cached);
        return { key, timestamp: entry.timestamp };
      } catch {
        return null;
      }
    }).filter(Boolean) as { key: string; timestamp: number }[];

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest entries until we're under the limit
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    toRemove.forEach(e => localStorage.removeItem(e.key));
  } catch {
    // Ignore cleanup errors
  }
}

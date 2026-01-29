/**
 * PHASE-2B-B1: Match State Fetcher Service
 *
 * Purpose: Fetch accurate match state with TheSports API as PRIMARY source
 *
 * Strategy:
 * - PRIMARY: TheSports API /match endpoint (real-time data)
 * - FALLBACK: Database ts_matches table (stale data)
 * - Circuit Breaker: 5 consecutive API failures → 60s DB-only mode
 * - Rate Limit: 429 response → count as breaker failure
 *
 * Guarantees:
 * - Always returns status_id (API or DB)
 * - Logs source for observability
 * - Minimal latency (<1500ms)
 *
 * @author GoalGPT Team
 * @version 1.0.0 - PHASE-2B-B1
 */

import { pool } from '../../database/connection';
import { TheSportsClient } from '../../integrations/thesports/TheSportsClient';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface MatchStateResult {
  statusId: number;
  source: 'thesports_api' | 'db_fallback';
  isFallback: boolean;
  latencyMs: number;
  cached: boolean;
}

interface TheSportsMatchResponse {
  status_id?: number;
  id?: string;
}

// ============================================================================
// CIRCUIT BREAKER STATE
// ============================================================================

interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  consecutiveFailures: 0,
  lastFailureTime: 0,
  isOpen: false,
};

const BREAKER_THRESHOLD = 5; // 5 consecutive failures
const BREAKER_COOLDOWN_MS = 60_000; // 60 seconds
const API_TIMEOUT_MS = 1500; // 1.5 seconds (fast)
const CACHE_TTL_MS = 30_000; // 30 seconds

// ============================================================================
// IN-MEMORY CACHE (Optional optimization)
// ============================================================================

interface CacheEntry {
  statusId: number;
  source: 'thesports_api' | 'db_fallback';
  timestamp: number;
}

const matchStateCache = new Map<string, CacheEntry>();

/**
 * Clear expired cache entries (runs periodically)
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [matchId, entry] of matchStateCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      matchStateCache.delete(matchId);
    }
  }
}

// Clean cache every 60 seconds
setInterval(cleanExpiredCache, 60_000);

// ============================================================================
// CIRCUIT BREAKER LOGIC
// ============================================================================

/**
 * Check if circuit breaker is currently open
 */
function isCircuitBreakerOpen(): boolean {
  if (!circuitBreaker.isOpen) {
    return false;
  }

  // Check if cooldown period has passed
  const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
  if (timeSinceLastFailure >= BREAKER_COOLDOWN_MS) {
    // Reset circuit breaker
    logger.info('[MatchStateFetcher] 🔓 Circuit breaker CLOSED (cooldown expired)', {
      cooldown_ms: BREAKER_COOLDOWN_MS,
      time_since_last_failure: timeSinceLastFailure,
    });
    circuitBreaker.isOpen = false;
    circuitBreaker.consecutiveFailures = 0;
    return false;
  }

  return true;
}

/**
 * Record API failure for circuit breaker
 */
function recordApiFailure(): void {
  circuitBreaker.consecutiveFailures++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.consecutiveFailures >= BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    logger.warn('[MatchStateFetcher] 🔒 Circuit breaker OPENED (too many failures)', {
      consecutive_failures: circuitBreaker.consecutiveFailures,
      threshold: BREAKER_THRESHOLD,
      cooldown_ms: BREAKER_COOLDOWN_MS,
    });
  } else {
    logger.warn('[MatchStateFetcher] ⚠️ API failure recorded', {
      consecutive_failures: circuitBreaker.consecutiveFailures,
      threshold: BREAKER_THRESHOLD,
    });
  }
}

/**
 * Record API success (resets circuit breaker)
 */
function recordApiSuccess(): void {
  if (circuitBreaker.consecutiveFailures > 0) {
    logger.info('[MatchStateFetcher] ✅ API success (resetting breaker)', {
      previous_failures: circuitBreaker.consecutiveFailures,
    });
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.isOpen = false;
  }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Fetch match state from TheSports API (PRIMARY source)
 */
async function fetchFromApi(matchId: string): Promise<number> {
  const client = TheSportsClient.getInstance();

  try {
    const response = await client.get<TheSportsMatchResponse>(
      '/match',
      { match_id: matchId },
      { timeoutMs: API_TIMEOUT_MS }
    );

    if (response && typeof response.status_id === 'number') {
      logger.info('[MatchStateFetcher] ✅ Fetched from API', {
        match_id: matchId,
        status_id: response.status_id,
      });
      return response.status_id;
    }

    // Response missing status_id
    throw new Error('API response missing status_id');
  } catch (error: any) {
    // Check for rate limit (429)
    if (error?.message?.includes('429') || error?.statusCode === 429) {
      logger.warn('[MatchStateFetcher] ⚠️ Rate limit (429) - counting as breaker failure', {
        match_id: matchId,
      });
    }

    logger.error('[MatchStateFetcher] ❌ API fetch failed', {
      match_id: matchId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Fetch match state from Database (FALLBACK source)
 */
async function fetchFromDb(matchId: string): Promise<number> {
  try {
    const result = await pool.query(
      'SELECT status_id FROM ts_matches WHERE external_id = $1 LIMIT 1',
      [matchId]
    );

    if (result.rows.length === 0) {
      throw new Error('Match not found in database');
    }

    const statusId = result.rows[0].status_id;

    if (statusId === null || statusId === undefined) {
      throw new Error('Database status_id is null');
    }

    logger.info('[MatchStateFetcher] ✅ Fetched from DB (fallback)', {
      match_id: matchId,
      status_id: statusId,
    });

    return statusId;
  } catch (error) {
    logger.error('[MatchStateFetcher] ❌ DB fetch failed', {
      match_id: matchId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * PHASE-2B-B1: Primary function to get match state for publishing
 *
 * Strategy:
 * 1. Check cache (30s TTL)
 * 2. If circuit breaker OPEN → skip API, use DB
 * 3. Try TheSports API (1500ms timeout)
 * 4. On API failure → fallback to DB
 * 5. Cache result for 30s
 *
 * @param matchId - TheSports external match ID
 * @returns Match state result with source tracking
 * @throws Error if both API and DB fail
 */
export async function fetchMatchStateForPublish(matchId: string): Promise<MatchStateResult> {
  const startTime = Date.now();
  const logContext = { match_id: matchId };

  logger.info('[MatchStateFetcher] 🔍 Fetching match state...', logContext);

  // 1. Check cache
  const cached = matchStateCache.get(matchId);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL_MS) {
      const latencyMs = Date.now() - startTime;
      logger.info('[MatchStateFetcher] 💾 Cache HIT', {
        ...logContext,
        status_id: cached.statusId,
        source: cached.source,
        cache_age_ms: age,
        latency_ms: latencyMs,
      });

      return {
        statusId: cached.statusId,
        source: cached.source,
        isFallback: cached.source === 'db_fallback',
        latencyMs,
        cached: true,
      };
    } else {
      // Expired cache entry
      matchStateCache.delete(matchId);
    }
  }

  // 2. Check circuit breaker
  if (isCircuitBreakerOpen()) {
    logger.warn('[MatchStateFetcher] 🔒 Circuit breaker OPEN - using DB fallback', logContext);

    try {
      const statusId = await fetchFromDb(matchId);
      const latencyMs = Date.now() - startTime;

      // Cache DB result
      matchStateCache.set(matchId, {
        statusId,
        source: 'db_fallback',
        timestamp: Date.now(),
      });

      return {
        statusId,
        source: 'db_fallback',
        isFallback: true,
        latencyMs,
        cached: false,
      };
    } catch (dbError) {
      throw new Error(`Circuit breaker open + DB fallback failed: ${dbError}`);
    }
  }

  // 3. Try TheSports API (PRIMARY)
  try {
    const statusId = await fetchFromApi(matchId);
    recordApiSuccess(); // Reset breaker on success

    const latencyMs = Date.now() - startTime;

    // Cache API result
    matchStateCache.set(matchId, {
      statusId,
      source: 'thesports_api',
      timestamp: Date.now(),
    });

    logger.info('[MatchStateFetcher] ✅ Match state fetched from API', {
      ...logContext,
      status_id: statusId,
      source: 'thesports_api',
      latency_ms: latencyMs,
    });

    return {
      statusId,
      source: 'thesports_api',
      isFallback: false,
      latencyMs,
      cached: false,
    };
  } catch (apiError) {
    // API failed - record failure and try DB fallback
    recordApiFailure();

    logger.warn('[MatchStateFetcher] ⚠️ API failed - trying DB fallback', {
      ...logContext,
      api_error: apiError instanceof Error ? apiError.message : String(apiError),
    });

    try {
      const statusId = await fetchFromDb(matchId);
      const latencyMs = Date.now() - startTime;

      // Cache DB result
      matchStateCache.set(matchId, {
        statusId,
        source: 'db_fallback',
        timestamp: Date.now(),
      });

      logger.info('[MatchStateFetcher] ✅ Match state fetched from DB (fallback)', {
        ...logContext,
        status_id: statusId,
        source: 'db_fallback',
        latency_ms: latencyMs,
      });

      return {
        statusId,
        source: 'db_fallback',
        isFallback: true,
        latencyMs,
        cached: false,
      };
    } catch (dbError) {
      // Both API and DB failed
      logger.error('[MatchStateFetcher] ❌ Both API and DB failed', {
        ...logContext,
        api_error: apiError instanceof Error ? apiError.message : String(apiError),
        db_error: dbError instanceof Error ? dbError.message : String(dbError),
      });

      throw new Error(
        `Failed to fetch match state from both API and DB. API: ${apiError}, DB: ${dbError}`
      );
    }
  }
}

/**
 * Clear match state cache (for testing)
 */
export function clearMatchStateCache(): void {
  matchStateCache.clear();
  logger.info('[MatchStateFetcher] 🧹 Cache cleared');
}

/**
 * Get cache statistics (for monitoring)
 */
export function getMatchStateCacheStats(): { size: number; entries: string[] } {
  return {
    size: matchStateCache.size,
    entries: Array.from(matchStateCache.keys()),
  };
}

/**
 * Get circuit breaker status (for monitoring)
 */
export function getCircuitBreakerStatus(): CircuitBreakerState {
  return { ...circuitBreaker };
}

/**
 * Reset circuit breaker (for testing)
 */
export function resetCircuitBreaker(): void {
  circuitBreaker.consecutiveFailures = 0;
  circuitBreaker.lastFailureTime = 0;
  circuitBreaker.isOpen = false;
  logger.info('[MatchStateFetcher] 🔄 Circuit breaker reset');
}

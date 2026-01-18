/**
 * AI Predictions Live Data Service
 *
 * Fetches live match data from TheSports detail_live endpoint
 * Specifically for AI Predictions page - no import conflicts
 *
 * Uses 2-second cache as recommended by TheSports API
 * FIXED: Added timeout and error handling to prevent endpoint hanging
 */

import { theSportsAPI } from '../../core/TheSportsAPIManager';
import { logger } from '../../utils/logger';

interface DetailLiveMatch {
  id: string;
  status_id: number;
  minute: number | null;
  home_score_display: number;
  away_score_display: number;
  first_half_kickoff_ts: number | null;
  second_half_kickoff_ts: number | null;
}

// Raw format from TheSports API (MQTT-like structure)
interface RawDetailLiveMatch {
  id: string;
  score?: any[]; // [match_id, status_id, home_scores, away_scores, timestamp, ...]
  stats?: any[];
  incidents?: any[];
  tlive?: any[];
}

interface DetailLiveResponse {
  results: RawDetailLiveMatch[];
}

/**
 * Parse raw TheSports detail_live response to our expected format
 * Score array format: [match_id, status_id, home_score_array, away_score_array, timestamp, ...]
 * Score arrays: [regular, extra_time, penalty, ..., total] - we use position 4 for total
 */
function parseDetailLiveMatch(raw: RawDetailLiveMatch): DetailLiveMatch | null {
  if (!raw.score || !Array.isArray(raw.score) || raw.score.length < 5) {
    logger.warn(`[AIPredictionsLiveData] Invalid score format for match ${raw.id}`);
    return null;
  }

  const statusId = raw.score[1];
  const homeScoreArray = raw.score[2];
  const awayScoreArray = raw.score[3];
  const timestamp = raw.score[4];

  // Extract total goals from position 4 in score arrays
  const homeScore = Array.isArray(homeScoreArray) && homeScoreArray.length > 4 ? homeScoreArray[4] : 0;
  const awayScore = Array.isArray(awayScoreArray) && awayScoreArray.length > 4 ? awayScoreArray[4] : 0;

  return {
    id: raw.id,
    status_id: statusId,
    minute: null, // Will be calculated using kickoff timestamps
    home_score_display: homeScore,
    away_score_display: awayScore,
    first_half_kickoff_ts: null, // Not available in this endpoint
    second_half_kickoff_ts: null, // Not available in this endpoint
  };
}

// In-memory cache with 30-second TTL (prevents memory overflow from 191 match responses)
const cache = new Map<string, { data: DetailLiveMatch | null; expiry: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds (TheSports recommends 2s, but we fetch ALL matches so need longer cache)
const API_TIMEOUT_MS = 10000; // 10 seconds timeout (TheSports API can be slow)
const MAX_CACHE_SIZE = 500; // Prevent unbounded cache growth

/**
 * Promise with timeout wrapper
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Calculate match minute using kickoff timestamps
 * Formula from TheSports API docs:
 * - First half: (current_ts - first_half_kickoff_ts) / 60 + 1
 * - Second half: (current_ts - second_half_kickoff_ts) / 60 + 45 + 1
 */
export function calculateMatchMinute(
  statusId: number,
  firstHalfKickoffTs: number | null,
  secondHalfKickoffTs: number | null
): number | null {
  const nowTs = Math.floor(Date.now() / 1000);

  // Status 2 = First Half
  if (statusId === 2 && firstHalfKickoffTs) {
    const elapsed = nowTs - firstHalfKickoffTs;
    return Math.floor(elapsed / 60) + 1;
  }

  // Status 4 = Second Half, Status 5 = Overtime
  if ((statusId === 4 || statusId === 5) && secondHalfKickoffTs) {
    const elapsed = nowTs - secondHalfKickoffTs;
    return Math.floor(elapsed / 60) + 45 + 1;
  }

  return null;
}

/**
 * Get live data for a single match
 */
export async function getMatchDetailLive(matchId: string): Promise<DetailLiveMatch | null> {
  try {
    // Check cache first
    const cached = cache.get(matchId);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Fetch from TheSports API with timeout
    const response = await withTimeout(
      theSportsAPI.get<DetailLiveResponse>('/match/detail_live', {
        match_id: matchId,
      }),
      API_TIMEOUT_MS
    );

    // Extract and parse match from results
    const rawMatch = response.results?.[0];
    const match = rawMatch ? parseDetailLiveMatch(rawMatch) : null;

    // Cache result (even if null)
    cache.set(matchId, {
      data: match,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    enforceCacheSizeLimit();

    return match;
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    logger.warn(`[AIPredictionsLiveData] Failed to fetch match ${matchId}: ${errorMsg}`);

    // Cache null result to prevent repeated failed attempts
    cache.set(matchId, {
      data: null,
      expiry: Date.now() + CACHE_TTL_MS,
    });
    enforceCacheSizeLimit();

    return null;
  }
}

/**
 * Get live data for multiple matches (batch)
 * Returns a Map of matchId -> DetailLiveMatch
 *
 * CRITICAL: Non-blocking - if API fails, returns empty Map and logs warning
 */
export async function getMatchesDetailLive(matchIds: string[]): Promise<Map<string, DetailLiveMatch>> {
  const result = new Map<string, DetailLiveMatch>();

  if (matchIds.length === 0) {
    return result;
  }

  try {
    // Separate cached vs uncached
    const uncached: string[] = [];
    const now = Date.now();

    for (const matchId of matchIds) {
      const cached = cache.get(matchId);
      if (cached && now < cached.expiry && cached.data) {
        result.set(matchId, cached.data);
      } else {
        uncached.push(matchId);
      }
    }

    // If all cached, return early
    if (uncached.length === 0) {
      return result;
    }

    logger.debug(`[AIPredictionsLiveData] Fetching ${uncached.length} matches (${matchIds.length} total, ${result.size} cached)`);

    // CRITICAL FIX: TheSports API returns ALL live matches (ignores match_id param!)
    // Solution: Fetch once and filter locally
    let successCount = 0;
    let failCount = 0;

    try {
      const response = await withTimeout(
        theSportsAPI.get<DetailLiveResponse>('/match/detail_live'),
        API_TIMEOUT_MS
      );

      if (response.results && Array.isArray(response.results)) {
        logger.debug(`[AIPredictionsLiveData] Received ${response.results.length} live matches from API`);

        // Build a lookup map from all live matches (parse raw format)
        const liveMatchesMap = new Map<string, DetailLiveMatch>();
        for (const rawMatch of response.results) {
          const parsed = parseDetailLiveMatch(rawMatch);
          if (parsed) {
            liveMatchesMap.set(parsed.id, parsed);
          }
        }

        logger.debug(`[AIPredictionsLiveData] Successfully parsed ${liveMatchesMap.size} matches`);

        // Find our requested matches in the response
        for (const matchId of uncached) {
          const match = liveMatchesMap.get(matchId);

          if (match) {
            result.set(match.id, match);

            // Cache it
            cache.set(match.id, {
              data: match,
              expiry: now + CACHE_TTL_MS,
            });

            successCount++;
          } else {
            // Cache null for not found
            cache.set(matchId, {
              data: null,
              expiry: now + CACHE_TTL_MS,
            });
            failCount++;
          }
        }

        // Enforce cache size limit after batch insert
        enforceCacheSizeLimit();
      }

      if (successCount > 0) {
        logger.debug(`[AIPredictionsLiveData] Successfully fetched ${successCount}/${uncached.length} matches`);
      }
      if (failCount > 0) {
        logger.debug(`[AIPredictionsLiveData] ${failCount}/${uncached.length} matches not found in live feed`);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      logger.warn(`[AIPredictionsLiveData] Failed to fetch live matches: ${errorMsg}`);
    }

    return result;
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    logger.warn(`[AIPredictionsLiveData] Batch fetch failed (${matchIds.length} matches): ${errorMsg}`);

    // CRITICAL: Return partial results instead of throwing
    // This prevents the entire endpoint from failing
    return result;
  }
}

/**
 * Clear cache (for testing or manual refresh)
 */
export function clearCache(): void {
  cache.clear();
  logger.debug('[AIPredictionsLiveData] Cache cleared');
}

/**
 * Cleanup expired cache entries (called periodically)
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of cache.entries()) {
    if (now >= value.expiry) {
      cache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`[AIPredictionsLiveData] Cleaned ${cleaned} expired cache entries`);
  }
}

/**
 * Enforce cache size limit by removing oldest entries
 */
function enforceCacheSizeLimit(): void {
  if (cache.size <= MAX_CACHE_SIZE) {
    return;
  }

  // Sort by expiry time and remove oldest entries
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].expiry - b[1].expiry);

  const toRemove = cache.size - MAX_CACHE_SIZE;
  for (let i = 0; i < toRemove; i++) {
    cache.delete(entries[i][0]);
  }

  logger.warn(`[AIPredictionsLiveData] Cache size limit reached, removed ${toRemove} oldest entries`);
}

// Auto-cleanup every 10 seconds
setInterval(cleanupExpiredCache, 10000);

/**
 * Lineup Pre-Sync Job - Phase 7 Implementation
 *
 * Proactively fetches lineup data for matches starting soon.
 * Ensures lineup tab has data before users open match details.
 *
 * Schedule: Every 15 minutes
 * Target: Matches starting in next 60 minutes that don't have lineup data
 *
 * Benefits:
 * - Lineup always available when match is about to start
 * - No API call needed in getMatchFull for upcoming matches
 * - Retry mechanism for failed fetches
 */

import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { memoryCache } from '../utils/cache/memoryCache';

// Job state tracking
let isRunning = false;
let lastRunTime: Date | null = null;
let lastSyncCount = 0;

// Configuration
const MINUTES_BEFORE_MATCH = 60;  // Fetch lineups for matches starting in next 60 minutes
const MAX_MATCHES_PER_RUN = 20;   // Limit to avoid overwhelming API
const RETRY_DELAY_MS = 2000;       // Delay between retries
const MAX_RETRIES = 2;             // Max retries per match

/**
 * Parse lineup data from TheSports API response
 */
function parseLineupData(apiResponse: any): {
  home: any[];
  away: any[];
  home_formation: string | null;
  away_formation: string | null;
} | null {
  const results = apiResponse?.results;
  if (!results) return null;

  // Handle array or object format
  const data = Array.isArray(results) ? results[0] : results;
  if (!data) return null;

  return {
    home: data.home || data.home_lineup || [],
    away: data.away || data.away_lineup || [],
    home_formation: data.home_formation || null,
    away_formation: data.away_formation || null,
  };
}

/**
 * Fetch lineup for a single match with retry
 */
async function fetchLineupWithRetry(matchId: string, retries = 0): Promise<boolean> {
  try {
    const response = await theSportsAPI.get<any>('/match/lineup/detail', { match_id: matchId });

    const lineup = parseLineupData(response);
    if (!lineup || (lineup.home.length === 0 && lineup.away.length === 0)) {
      logger.debug(`[LineupPreSync] No lineup data available for ${matchId}`);
      return false;
    }

    // Save to database
    await pool.query(`
      UPDATE ts_matches
      SET
        lineup_data = $2::jsonb,
        home_formation = $3,
        away_formation = $4,
        updated_at = NOW()
      WHERE external_id = $1
    `, [
      matchId,
      JSON.stringify({ home: lineup.home, away: lineup.away }),
      lineup.home_formation,
      lineup.away_formation,
    ]);

    // Invalidate memory cache
    memoryCache.invalidateMatch(matchId);

    logger.info(`[LineupPreSync] ✓ Synced lineup for ${matchId} (${lineup.home.length}H + ${lineup.away.length}A players)`);
    return true;

  } catch (error: any) {
    if (retries < MAX_RETRIES) {
      logger.warn(`[LineupPreSync] Retry ${retries + 1}/${MAX_RETRIES} for ${matchId}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchLineupWithRetry(matchId, retries + 1);
    }

    logger.error(`[LineupPreSync] Failed to fetch lineup for ${matchId} after ${MAX_RETRIES} retries: ${error.message}`);
    return false;
  }
}

/**
 * Get matches starting soon without lineup data
 */
async function getMatchesNeedingLineup(): Promise<Array<{ external_id: string; match_time: number }>> {
  const nowTs = Math.floor(Date.now() / 1000);
  const futureTs = nowTs + (MINUTES_BEFORE_MATCH * 60);

  const result = await pool.query(`
    SELECT external_id, match_time
    FROM ts_matches
    WHERE status_id = 1
      AND match_time >= $1
      AND match_time <= $2
      AND (lineup_data IS NULL OR lineup_data = '{}' OR lineup_data = 'null')
    ORDER BY match_time ASC
    LIMIT $3
  `, [nowTs, futureTs, MAX_MATCHES_PER_RUN]);

  return result.rows;
}

/**
 * Main sync function
 */
export async function runLineupPreSync(): Promise<void> {
  if (isRunning) {
    logger.debug('[LineupPreSync] Already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // Get matches needing lineup
    const matches = await getMatchesNeedingLineup();

    if (matches.length === 0) {
      logger.debug('[LineupPreSync] No matches need lineup sync');
      isRunning = false;
      return;
    }

    logger.info(`[LineupPreSync] Found ${matches.length} matches starting in next ${MINUTES_BEFORE_MATCH} minutes without lineup`);

    let successCount = 0;
    let failCount = 0;

    for (const match of matches) {
      const minutesUntilStart = Math.round((match.match_time - Date.now() / 1000) / 60);
      logger.debug(`[LineupPreSync] Processing ${match.external_id} (starts in ${minutesUntilStart} min)`);

      const success = await fetchLineupWithRetry(match.external_id);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = Date.now() - startTime;
    lastRunTime = new Date();
    lastSyncCount = successCount;

    logger.info(`[LineupPreSync] Completed: ${successCount} synced, ${failCount} failed (${duration}ms)`);

    if (successCount > 0) {
      logEvent('info', 'lineup_presync.completed', {
        matches: matches.length,
        synced: successCount,
        failed: failCount,
        duration_ms: duration,
      });
    }

  } catch (error: any) {
    logger.error('[LineupPreSync] Job failed:', error.message);
    logEvent('error', 'lineup_presync.failed', { error: error.message });
  } finally {
    isRunning = false;
  }
}

/**
 * Get job status for monitoring
 */
export function getLineupPreSyncStatus(): {
  isRunning: boolean;
  lastRunTime: Date | null;
  lastSyncCount: number;
} {
  return {
    isRunning,
    lastRunTime,
    lastSyncCount,
  };
}

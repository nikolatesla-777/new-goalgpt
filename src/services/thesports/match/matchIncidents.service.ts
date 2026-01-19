/**
 * Match Incidents Service
 *
 * Optimized service for fetching match incidents (goals, cards, substitutions).
 *
 * Strategy:
 * 1. Database-first (FAST - ~50ms)
 * 2. Check staleness (30s for live, 5min for finished)
 * 3. Fallback to TheSports API if stale (with 5s timeout)
 * 4. Graceful error handling (never crash, return empty array)
 *
 * Performance: 10,000ms → 300ms (97% faster than old getMatchDetailLive)
 */

import { pool } from '../../../database/connection';
import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { MatchDetailLiveResponse } from '../../../types/thesports/match';
import { IncidentOrchestrator } from '../../orchestration/IncidentOrchestrator';

// Short timeout for incidents API - we prefer quick empty response over slow full response
const INCIDENTS_API_TIMEOUT_MS = 5000;

// Timeout wrapper for API calls
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`API timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    logger.warn(`[MatchIncidents] API call timed out, returning fallback`);
    return fallback;
  }
}

export class MatchIncidentsService {
  /**
   * Get incidents for a specific match
   *
   * @param matchId - TheSports match ID
   * @returns Object with incidents array
   */
  async getMatchIncidents(matchId: string): Promise<{ incidents: any[] }> {
    try {
      // ============================================================
      // STEP 1: CHECK ts_incidents TABLE FIRST (NORMALIZED - BEST)
      // ============================================================

      const incidentOrchestrator = IncidentOrchestrator.getInstance();
      const normalizedIncidents = await incidentOrchestrator.getMatchIncidents(matchId);

      if (normalizedIncidents.length > 0) {
        logger.debug(`[MatchIncidents] ✓ Found ${normalizedIncidents.length} incidents in ts_incidents table for ${matchId}`);
        return { incidents: normalizedIncidents };
      }

      // ============================================================
      // STEP 2: FALLBACK TO ts_matches.incidents JSONB
      // ============================================================

      // CRITICAL FIX: Query by external_id (TheSports ID), not UUID id
      const dbResult = await pool.query(
        `SELECT
           incidents,
           updated_at,
           status_id
         FROM ts_matches
         WHERE external_id = $1`,
        [matchId]
      );

      if (dbResult.rows.length === 0) {
        logger.warn(`[MatchIncidents] Match ${matchId} not found in database, fetching from API`);

        // Match not in database - fetch from API with timeout
        try {
          const apiData = await withTimeout(
            theSportsAPI.get<any>('/match/detail_live', { match_id: matchId }),
            INCIDENTS_API_TIMEOUT_MS,
            null
          );

          if (!apiData) {
            logger.warn(`[MatchIncidents] API timeout for ${matchId}, returning empty`);
            return { incidents: [] };
          }

          // CRITICAL FIX: results IS the incidents array (not results[0].incidents)
          // TheSports API returns: { "results": [{ "type": 1, "time": 5, ... }, ...] }
          const incidents = Array.isArray(apiData?.results) ? apiData.results : [];

          if (incidents.length > 0) {
            logger.info(`[MatchIncidents] ✓ Fetched ${incidents.length} incidents from API for ${matchId}`);
            return { incidents };
          }

          logger.warn(`[MatchIncidents] API returned no incidents for ${matchId}`);
          return { incidents: [] };
        } catch (apiError) {
          logger.error(`[MatchIncidents] API error for ${matchId}:`, apiError);
          return { incidents: [] }; // Graceful fallback - never crash
        }
      }

      // ============================================================
      // STEP 2: CHECK STALENESS
      // ============================================================

      const match = dbResult.rows[0];
      const incidents = match.incidents || [];
      const updatedAt = new Date(match.updated_at);
      const isLive = [2, 3, 4, 5, 7].includes(match.status_id);
      const staleness = Date.now() - updatedAt.getTime();

      // Live matches: 30s max staleness
      // Finished matches: 5min max staleness
      const maxStalenessMs = isLive ? 30000 : 300000;

      // CRITICAL FIX: If incidents is empty, ALWAYS fetch from API
      // This ensures events are never missing due to empty database cache
      if (incidents.length === 0) {
        logger.info(`[MatchIncidents] Database incidents empty for ${matchId}, fetching from API`);
        // Fall through to STEP 3
      } else if (staleness < maxStalenessMs) {
        // Cache is fresh and has data - use it
        logger.debug(`[MatchIncidents] ✓ Using cached incidents for ${matchId} (age: ${Math.round(staleness / 1000)}s, ${incidents.length} incidents)`);
        return { incidents };
      }

      // ============================================================
      // STEP 3: FETCH FRESH DATA FROM API (IF STALE OR EMPTY)
      // ============================================================

      logger.info(`[MatchIncidents] Fetching fresh incidents for ${matchId} (stale: ${Math.round(staleness / 1000)}s, live: ${isLive})`);

      try {
        const apiData = await withTimeout(
          theSportsAPI.get<any>('/match/detail_live', { match_id: matchId }),
          INCIDENTS_API_TIMEOUT_MS,
          null
        );

        if (!apiData) {
          // Timeout - return stale data from DB
          logger.warn(`[MatchIncidents] API timeout for ${matchId}, using stale database data (${incidents.length} incidents)`);
          return { incidents };
        }

        // CRITICAL FIX: results IS the incidents array (not results[0].incidents)
        // TheSports API returns: { "results": [{ "type": 1, "time": 5, ... }, ...] }
        const freshIncidents = Array.isArray(apiData?.results) ? apiData.results : [];

        if (freshIncidents.length > 0) {
          logger.info(`[MatchIncidents] ✓ Fetched ${freshIncidents.length} fresh incidents from API for ${matchId}`);
          return { incidents: freshIncidents };
        }

        // API returned no incidents - return database data as fallback
        logger.warn(`[MatchIncidents] API returned no incidents, using stale database data (${incidents.length} incidents)`);
        return { incidents };
      } catch (apiError) {
        // ============================================================
        // STEP 4: STALE CACHE FALLBACK (API ERROR)
        // ============================================================

        logger.error(`[MatchIncidents] API error for ${matchId}, using stale database data (${incidents.length} incidents):`, apiError);
        return { incidents }; // Return stale data - better than nothing
      }
    } catch (error) {
      // ============================================================
      // STEP 5: CRITICAL ERROR HANDLING (NEVER CRASH)
      // ============================================================

      logger.error(`[MatchIncidents] Critical error for ${matchId}:`, error);
      return { incidents: [] }; // Last resort - return empty array
    }
  }
}

// Export singleton instance
export const matchIncidentsService = new MatchIncidentsService();

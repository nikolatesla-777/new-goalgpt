/**
 * Match Incidents Service
 *
 * Optimized service for fetching match incidents (goals, cards, substitutions).
 *
 * Strategy:
 * 1. Database-first (FAST - ~50ms)
 * 2. Check staleness (30s for live, 5min for finished)
 * 3. Fallback to TheSports API if stale
 * 4. Graceful error handling (never crash, return empty array)
 *
 * Performance: 10,000ms → 300ms (97% faster than old getMatchDetailLive)
 */

import { pool } from '../../../database/connection';
import { theSportsAPI } from '../../../core/TheSportsAPIManager';
import { logger } from '../../../utils/logger';
import { MatchDetailLiveResponse } from '../../../types/thesports/match';

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
      // STEP 1: DATABASE FIRST (FAST - ~50ms)
      // ============================================================

      const dbResult = await pool.query(
        `SELECT
           incidents,
           updated_at,
           status_id
         FROM ts_matches
         WHERE id = $1`,
        [matchId]
      );

      if (dbResult.rows.length === 0) {
        logger.warn(`[MatchIncidents] Match ${matchId} not found in database, fetching from API`);

        // Match not in database - fetch from API
        try {
          const apiData = await theSportsAPI.get<any>('/match/detail_live', { match_id: matchId });

          // Extract incidents (can be in different properties)
          const result = apiData?.results?.[0] || apiData?.result;
          const incidents = result?.incidents || result?.events || result?.match_incidents || [];

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
        const apiData = await theSportsAPI.get<any>('/match/detail_live', { match_id: matchId });

        // Extract incidents (can be in different properties)
        const result = apiData?.results?.[0] || apiData?.result;
        const freshIncidents = result?.incidents || result?.events || result?.match_incidents || [];

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

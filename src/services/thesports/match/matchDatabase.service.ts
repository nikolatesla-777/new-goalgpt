/**
 * Match Database Service
 * 
 * Queries matches directly from the database (ts_matches table)
 * This is used for the frontend to display matches without hitting the API
 */

import { pool } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { MatchDiaryResponse } from '../../../types/thesports/match';
import { TheSportsClient } from '../client/thesports-client';
import { MatchRecentService } from './matchRecent.service';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { generateMinuteText } from '../../../utils/matchMinuteText';

export class MatchDatabaseService {
  private theSportsClient: TheSportsClient;
  private matchRecentService: MatchRecentService;

  constructor() {
    this.theSportsClient = new TheSportsClient();
    this.matchRecentService = new MatchRecentService(this.theSportsClient);
  }

  /**
   * Get matches from database for a specific date
   * Date format: YYYY-MM-DD or YYYYMMDD
   */
  async getMatchesByDate(date: string): Promise<MatchDiaryResponse> {
    try {
      // Convert date format to YYYYMMDD if needed
      let dateStr = date.replace(/-/g, '');
      if (!/^\d{8}$/.test(dateStr)) {
        logger.error(`Invalid date format: ${date}. Expected YYYYMMDD or YYYY-MM-DD`);
        return { results: [], err: 'Invalid date format' };
      }

      // Parse date to get start and end of day (Unix timestamps)
      // CRITICAL: Use local timezone for date boundaries, but match_time is stored as UTC
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      
      // TSİ (UTC+3) day boundaries: convert local midnight to UTC by subtracting 3 hours
      const TSI_OFFSET_SECONDS = 3 * 3600;
      const startOfDayUTC = new Date(Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000);
      const endOfDayUTC = new Date(Date.UTC(year, month, day, 23, 59, 59) - TSI_OFFSET_SECONDS * 1000);
      
      const startUnix = Math.floor(startOfDayUTC.getTime() / 1000);
      const endUnix = Math.floor(endOfDayUTC.getTime() / 1000);

      logger.info(`🔍 [MatchDatabase] Querying matches for date ${dateStr} (${startUnix} - ${endUnix})`);

      // Query matches with JOINs for teams and competitions
      const query = `
        SELECT 
          m.external_id as id,
          m.competition_id,
          m.season_id,
          m.match_time,
          m.status_id as status_id,
          m.minute,
          m.updated_at,
          m.provider_update_time,
          m.last_event_ts,
          m.home_team_id,
          m.away_team_id,
          m.home_score_regular as home_score,
          m.away_score_regular as away_score,
          m.home_score_overtime,
          m.away_score_overtime,
          m.home_score_penalties,
          m.away_score_penalties,
          m.home_score_display,
          m.away_score_display,
          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,
          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,
          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,
          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,
          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,
          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,
          -- CRITICAL: Use live_kickoff_time if available and different from match_time
          -- If live_kickoff_time is NULL or same as match_time, use match_time (match started on time)
          -- MQTT updates live_kickoff_time with the REAL kickoff time (Index 4)
          COALESCE(
            CASE 
              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time 
              THEN m.live_kickoff_time 
              ELSE m.match_time 
            END,
            m.match_time
          ) as live_kickoff_time,
          -- Home Team
          ht.name as home_team_name,
          ht.logo_url as home_team_logo,
          -- Away Team
          at.name as away_team_name,
          at.logo_url as away_team_logo,
          -- Competition
          c.name as competition_name,
          c.logo_url as competition_logo,
          c.country_id as competition_country_id
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        WHERE m.match_time >= $1 AND m.match_time <= $2
        ORDER BY m.match_time ASC, c.name ASC
      `;

      const result = await pool.query(query, [startUnix, endUnix]);
      const matches = result.rows || [];

      logger.info(`✅ [MatchDatabase] Found ${matches.length} matches in database for date ${dateStr}`);

      // Transform database rows to match API response format
      const transformedMatches = matches.map((row: any) => {
        // Status should be authoritative from DB (driven by WS/detail_live/data_update).
        // Only apply a minimal sanity rule: a future match cannot be END.
        let validatedStatus = row.status_id ?? 0;
        const now = Math.floor(Date.now() / 1000);
        const matchTime = row.match_time;

        if (matchTime && matchTime > now) {
          if (validatedStatus === 8 || validatedStatus === 12) {
            validatedStatus = 1; // NOT_STARTED
          }
        }

        return {
          id: row.id,
          competition_id: row.competition_id,
          season_id: row.season_id,
          match_time: row.match_time,
          status_id: validatedStatus,
          status: validatedStatus,
          home_team_id: row.home_team_id,
          away_team_id: row.away_team_id,
          home_score: (row.home_score ?? null),
          away_score: (row.away_score ?? null),
          home_score_overtime: (row.home_score_overtime ?? null),
          away_score_overtime: (row.away_score_overtime ?? null),
          home_score_penalties: (row.home_score_penalties ?? null),
          away_score_penalties: (row.away_score_penalties ?? null),
          home_red_cards: (row.home_red_cards ?? 0),
          away_red_cards: (row.away_red_cards ?? 0),
          home_yellow_cards: (row.home_yellow_cards ?? 0),
          away_yellow_cards: (row.away_yellow_cards ?? 0),
          home_corners: (row.home_corners ?? 0),
          away_corners: (row.away_corners ?? 0),
          live_kickoff_time: (row.live_kickoff_time ?? row.match_time ?? null),
          // Team data
          home_team: row.home_team_name ? {
            id: row.home_team_id,
            name: row.home_team_name,
            logo_url: row.home_team_logo || null,
          } : null,
          away_team: row.away_team_name ? {
            id: row.away_team_id,
            name: row.away_team_name,
            logo_url: row.away_team_logo || null,
          } : null,
          // Competition data
          competition: row.competition_name ? {
            id: row.competition_id,
            name: row.competition_name,
            logo_url: row.competition_logo || null,
            country_id: row.competition_country_id || null,
          } : null,
          // Raw names for fallback
          home_team_name: row.home_team_name || null,
          away_team_name: row.away_team_name || null,
        };
      });

      return {
        results: transformedMatches as any,
      };
    } catch (error: any) {
      logger.error(`❌ [MatchDatabase] Error querying matches:`, error);
      return {
        results: [],
        err: error.message || 'Database query failed',
      };
    }
  }

  /**
   * Get matches in "now window" (time-window endpoint, NOT strict live-only)
   * 
   * CRITICAL: Fetches from DATABASE (not API) because:
   * 1. MQTT/WebSocket updates DB in real-time when matches start
   * 2. DataUpdateWorker updates DB when matches change status
   * 3. DB is the single source of truth for live matches
   * 
   * SEMANTICS: This is a TIME-WINDOW endpoint, not strict live-only:
   * - Returns matches with status_id IN (2, 3, 4, 5, 7) (explicitly live)
   * - ALSO returns matches with status_id = 1 (NOT_STARTED) if match_time has passed (within today's window)
   * - Purpose: Catch matches that should have started but status hasn't updated yet
   * - This allows frontend to show "upcoming" matches that are in the current time window
   */
  async getLiveMatches(): Promise<MatchDiaryResponse> {
    try {
      // CRITICAL FIX: Disable cache for live matches - always fetch fresh from DB
      // Cache was causing stale data (showing 3 matches instead of 18)
      // Live matches change frequently, cache is not appropriate
      // Removed cache check - always fetch from DB

      logger.info(`🔍 [MatchDatabase] Querying live matches from DATABASE...`);

      const now = Math.floor(Date.now() / 1000);

      // Phase 5-S Fix: Removed "should be live" reconciliation from /live endpoint
      // "Should be live" matches are now handled by watchdog and exposed via /api/matches/should-be-live
      // This keeps /live endpoint strict, fast, and contract-compliant

      // Phase 5-S Fix: Query database for STRICTLY live matches only
      // CRITICAL: Return ONLY matches with status_id IN (2,3,4,5,7)
      // "Should be live" matches (status=1 but match_time passed) are handled by watchdog
      // and exposed via separate /api/matches/should-be-live endpoint
      const query = `
        SELECT
          m.external_id as id,
          m.competition_id,
          m.season_id,
          m.match_time,
          m.status_id as status_id,
          m.minute,
          m.updated_at,
          m.provider_update_time,
          m.last_event_ts,
          m.home_team_id,
          m.away_team_id,
          m.home_score_regular as home_score,
          m.away_score_regular as away_score,
          m.home_score_overtime,
          m.away_score_overtime,
          m.home_score_penalties,
          m.away_score_penalties,
          m.home_score_display,
          m.away_score_display,
          COALESCE(
            CASE
              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time
              THEN m.live_kickoff_time
              ELSE m.match_time
            END,
            m.match_time
          ) as live_kickoff_time,
          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,
          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,
          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,
          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,
          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,
          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,
          ht.name as home_team_name,
          ht.logo_url as home_team_logo,
          at.name as away_team_name,
          at.logo_url as away_team_logo,
          c.name as competition_name,
          c.logo_url as competition_logo,
          c.country_id as competition_country_id
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        WHERE m.status_id IN (2, 3, 4, 5, 7)  -- STRICT: Only explicitly live statuses
        ORDER BY m.match_time DESC, c.name ASC
      `;

      const result = await pool.query(query);
      const matches = result.rows || [];

      logger.info(`✅ [MatchDatabase] Found ${matches.length} strictly live matches in database (status_id IN 2,3,4,5,7 only)`);

      // CRITICAL FIX: Removed API fallback - DB is authoritative
      // API fallback was causing issues and returning 0 matches
      // All live matches should be in DB (synced by MatchSyncWorker, Watchdog, ProactiveCheck)
      // If matches are missing from DB, they need to be reconciled, not fetched from API here

      // Transform database rows to match API response format
      const transformedMatches = matches.map((row: any) => {
        let validatedStatus = row.status_id ?? 0;
        const now = Math.floor(Date.now() / 1000);
        const matchTime = row.match_time;

        // Sanity check: future matches cannot be END
        if (matchTime && matchTime > now) {
          if (validatedStatus === 8 || validatedStatus === 12) {
            validatedStatus = 1; // NOT_STARTED
          }
        }

        return {
          id: row.id,
          competition_id: row.competition_id,
          season_id: row.season_id,
          match_time: row.match_time,
          status_id: validatedStatus,
          status: validatedStatus,
          minute: (row.minute !== null && row.minute !== undefined) ? Number(row.minute) : null, // CRITICAL: Include minute field
          home_team_id: row.home_team_id,
          away_team_id: row.away_team_id,
          home_score: (row.home_score ?? null),
          away_score: (row.away_score ?? null),
          home_score_overtime: (row.home_score_overtime ?? null),
          away_score_overtime: (row.away_score_overtime ?? null),
          home_score_penalties: (row.home_score_penalties ?? null),
          away_score_penalties: (row.away_score_penalties ?? null),
          home_red_cards: (row.home_red_cards ?? 0),
          away_red_cards: (row.away_red_cards ?? 0),
          home_yellow_cards: (row.home_yellow_cards ?? 0),
          away_yellow_cards: (row.away_yellow_cards ?? 0),
          home_corners: (row.home_corners ?? 0),
          away_corners: (row.away_corners ?? 0),
          live_kickoff_time: (row.live_kickoff_time ?? row.match_time ?? null),
          home_team: row.home_team_name ? {
            id: row.home_team_id,
            name: row.home_team_name,
            logo_url: row.home_team_logo || null,
          } : null,
          away_team: row.away_team_name ? {
            id: row.away_team_id,
            name: row.away_team_name,
            logo_url: row.away_team_logo || null,
          } : null,
          competition: row.competition_name ? {
            id: row.competition_id,
            name: row.competition_name,
            logo_url: row.competition_logo || null,
            country_id: row.competition_country_id || null,
          } : null,
          home_team_name: row.home_team_name || null,
          away_team_name: row.away_team_name || null,
        };
      });

      // CRITICAL FIX: API fallback removed - only use DB matches
      // All live matches should be in DB (synced by MatchSyncWorker, Watchdog, ProactiveCheck)

      const response: MatchDiaryResponse = {
        results: transformedMatches as any,
      };

      // CRITICAL FIX: Cache disabled for live matches (was causing stale data)
      // Live matches change frequently, cache is not appropriate
      // await cacheService.set(cacheKey, response, CacheTTL.ThirtySeconds);

      return response;
    } catch (error: any) {
      logger.error(`❌ [MatchDatabase] Error querying live matches from database:`, error);
      return {
        results: [],
        err: error.message || 'Database query failed',
      };
    }
  }

  /**
   * Get matches that should be live (match_time passed but status still NOT_STARTED)
   * 
   * Phase 5-S: This is a separate endpoint for ops/debug visibility.
   * These matches are candidates for watchdog reconciliation.
   * 
   * @param maxMinutesAgo - Maximum minutes ago to check (default 120, max 240)
   * @param limit - Maximum number of matches to return (default 200, max 500)
   * @returns Matches with status_id=1 but match_time has passed
   */
  async getShouldBeLiveMatches(
    maxMinutesAgo: number = 120,
    limit: number = 200
  ): Promise<MatchDiaryResponse> {
    try {
      // Defensive limits
      const safeMaxMinutesAgo = Math.min(Math.max(1, maxMinutesAgo), 240);
      const safeLimit = Math.min(Math.max(1, limit), 500);

      const now = Math.floor(Date.now() / 1000);
      const minTime = now - (safeMaxMinutesAgo * 60);
      const todayStart = Math.floor(now / 86400) * 86400; // Today 00:00 UTC

      const query = `
        SELECT
          m.external_id as id,
          m.competition_id,
          m.season_id,
          m.match_time,
          m.status_id as status_id,
          m.minute,
          m.updated_at,
          m.provider_update_time,
          m.last_event_ts,
          m.home_team_id,
          m.away_team_id,
          m.home_score_regular as home_score,
          m.away_score_regular as away_score,
          m.home_score_overtime,
          m.away_score_overtime,
          m.home_score_penalties,
          m.away_score_penalties,
          m.home_score_display,
          m.away_score_display,
          COALESCE(
            CASE
              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time
              THEN m.live_kickoff_time
              ELSE m.match_time
            END,
            m.match_time
          ) as live_kickoff_time,
          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,
          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,
          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,
          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,
          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,
          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,
          ht.name as home_team_name,
          ht.logo_url as home_team_logo,
          at.name as away_team_name,
          at.logo_url as away_team_logo,
          c.name as competition_name,
          c.logo_url as competition_logo,
          c.country_id as competition_country_id
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        WHERE m.status_id = 1  -- NOT_STARTED
          AND m.match_time <= $1  -- match_time has passed
          AND m.match_time >= $2  -- Today's matches
          AND m.match_time >= $3  -- Within maxMinutesAgo window
        ORDER BY m.match_time DESC
        LIMIT $4
      `;

      const result = await pool.query(query, [now, todayStart, minTime, safeLimit]);
      const matches = result.rows || [];

      logger.info(`🔍 [MatchDatabase] Found ${matches.length} should-be-live matches (status=1, match_time passed, window=${safeMaxMinutesAgo}m)`);

      // Transform database rows to match API response format (same normalization as getLiveMatches)
      const transformedMatches = matches.map((row: any) => {
        const statusId = row.status_id ?? 1;
        const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
        const minuteText = generateMinuteText(minute, statusId);

        return {
          id: row.id,
          competition_id: row.competition_id,
          season_id: row.season_id,
          match_time: row.match_time,
          status_id: statusId,
          status: statusId,
          home_team_id: row.home_team_id,
          away_team_id: row.away_team_id,
          home_score: (row.home_score ?? null),
          away_score: (row.away_score ?? null),
          home_score_overtime: (row.home_score_overtime ?? null),
          away_score_overtime: (row.away_score_overtime ?? null),
          home_score_penalties: (row.home_score_penalties ?? null),
          away_score_penalties: (row.away_score_penalties ?? null),
          home_red_cards: (row.home_red_cards ?? 0),
          away_red_cards: (row.away_red_cards ?? 0),
          home_yellow_cards: (row.home_yellow_cards ?? 0),
          away_yellow_cards: (row.away_yellow_cards ?? 0),
          home_corners: (row.home_corners ?? 0),
          away_corners: (row.away_corners ?? 0),
          live_kickoff_time: (row.live_kickoff_time ?? row.match_time ?? null),
          minute: minute,
          minute_text: minuteText, // Phase 4-4: Always generate minute_text
          updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          provider_update_time: row.provider_update_time ? Number(row.provider_update_time) : null,
          last_event_ts: row.last_event_ts ? Number(row.last_event_ts) : null,
          home_team: row.home_team_name ? {
            id: row.home_team_id,
            name: row.home_team_name,
            logo_url: row.home_team_logo || null,
          } : null,
          away_team: row.away_team_name ? {
            id: row.away_team_id,
            name: row.away_team_name,
            logo_url: row.away_team_logo || null,
          } : null,
          competition: row.competition_name ? {
            id: row.competition_id,
            name: row.competition_name,
            logo_url: row.competition_logo || null,
            country_id: row.competition_country_id || null,
          } : null,
          home_team_name: row.home_team_name || null,
          away_team_name: row.away_team_name || null,
        };
      });

      return {
        results: transformedMatches as any,
      };
    } catch (error: any) {
      logger.error(`❌ [MatchDatabase] Error querying should-be-live matches:`, error);
      return {
        results: [],
        err: error.message || 'Database query failed',
      };
    }
  }
}

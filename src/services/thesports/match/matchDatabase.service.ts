
/**
 * Match Database Service
 * 
 * Queries matches directly from the database (ts_matches table)
 * This is used for the frontend to display matches without hitting the API
 */

import { pool } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import { MatchDiaryResponse } from '../../../types/thesports/match';
import { MatchRecentService } from './matchRecent.service';
import { cacheService } from '../../../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../../../utils/cache/types';
import { generateMinuteText } from '../../../utils/matchMinuteText';
import { liveMatchCache } from './liveMatchCache.service';
// SINGLETON: Use shared API client
import { theSportsAPI } from '../../../core';

export class MatchDatabaseService {
  private matchRecentService: MatchRecentService;

  constructor() {
    // SINGLETON: Use shared API client with global rate limiting
    this.matchRecentService = new MatchRecentService();
  }

  /**
   * Get matches from database for a specific date
   * Date format: YYYY-MM-DD or YYYYMMDD
   * @param statusFilter Optional array of status IDs to filter (e.g., [8] for finished, [1] for not started)
   * @param includeAI Optional flag to include AI predictions (default: false for backward compatibility)
   */
  async getMatchesByDate(date: string, statusFilter?: number[], includeAI: boolean = false): Promise<MatchDiaryResponse> {
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
      // CRITICAL FIX: Use 'let' instead of 'const' because we modify query string
      let query = `
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
          COALESCE(m.home_score_display, m.home_score_regular, 0) as home_score,
          COALESCE(m.away_score_display, m.away_score_regular, 0) as away_score,
          m.home_score_overtime,
          m.away_score_overtime,
          m.home_score_penalties,
          m.away_score_penalties,
          COALESCE(m.home_score_display, m.home_score_regular, 0) as home_score_display,
          COALESCE(m.away_score_display, m.away_score_regular, 0) as away_score_display,
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
          c.country_id as competition_country_id,
          -- Country (via competition)
          co.name as competition_country_name${includeAI ? `,
          -- AI Prediction (PHASE 1: Latest prediction per match)
          p.id as ai_id,
          p.canonical_bot_name,
          p.prediction,
          p.prediction_threshold,
          p.result as ai_result,
          p.result_reason,
          p.final_score as ai_final_score,
          p.access_type,
          p.minute_at_prediction,
          p.score_at_prediction,
          p.created_at as ai_created_at,
          p.resulted_at` : ''}
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        LEFT JOIN ts_countries co ON c.country_id = co.external_id${includeAI ? `
        -- PHASE 1: LEFT JOIN LATERAL for latest AI prediction per match
        LEFT JOIN LATERAL (
          SELECT id, canonical_bot_name, prediction, prediction_threshold, result,
                 result_reason, final_score, access_type, minute_at_prediction,
                 score_at_prediction, created_at, resulted_at
          FROM ai_predictions
          WHERE match_id = m.external_id
          ORDER BY created_at DESC
          LIMIT 1
        ) p ON true` : ''}
        WHERE m.match_time >= $1 AND m.match_time <= $2
      `;

      const params: any[] = [startUnix, endUnix];
      
      // CRITICAL FIX: Add status filter if provided
      if (statusFilter && statusFilter.length > 0) {
        query += ` AND m.status_id = ANY($${params.length + 1})`;
        params.push(statusFilter);
        logger.info(`🔍 [MatchDatabase] Filtering by status: ${statusFilter.join(', ')}`);
      }
      
      query += ` ORDER BY m.match_time ASC, c.name ASC`;

      const result = await pool.query(query, params);
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

        // CRITICAL FIX: Generate minute_text from minute and status_id (same as getLiveMatches)
        const minute = (row.minute !== null && row.minute !== undefined) ? Number(row.minute) : null;
        const minuteText = generateMinuteText(minute, validatedStatus);

        // PHASE 1: Map AI prediction fields if present
        const aiPrediction = (includeAI && row.ai_id) ? {
          id: row.ai_id,
          canonical_bot_name: row.canonical_bot_name,
          prediction: row.prediction,
          prediction_threshold: row.prediction_threshold,
          result: row.ai_result,
          result_reason: row.result_reason,
          final_score: row.ai_final_score,
          access_type: row.access_type,
          minute_at_prediction: row.minute_at_prediction,
          score_at_prediction: row.score_at_prediction,
          created_at: row.ai_created_at,
          resulted_at: row.resulted_at,
        } : undefined;

        return {
          id: row.id,
          competition_id: row.competition_id,
          season_id: row.season_id,
          match_time: row.match_time,
          status_id: validatedStatus,
          status: validatedStatus,
          minute: minute, // CRITICAL FIX: Include minute field
          minute_text: minuteText, // CRITICAL FIX: Include minute_text field (Phase 4-4 contract)
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
            country_name: row.competition_country_name || null,
          } : null,
          // Raw names for fallback
          home_team_name: row.home_team_name || null,
          away_team_name: row.away_team_name || null,
          // PHASE 1: AI Prediction (optional field)
          ...(aiPrediction ? { aiPrediction } : {}),
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
   *
   * @param includeAI Optional flag to include AI predictions (default: false for backward compatibility)
   */
  async getLiveMatches(includeAI: boolean = false): Promise<MatchDiaryResponse> {
    try {
      // CRITICAL FIX (2026-01-17): CACHE DISABLED for score debugging
      // Cache was causing stale scores to be returned
      // TODO: Re-enable after fixing cache invalidation
      /*
      const cached = liveMatchCache.getLiveMatches();
      if (cached) {
        logger.debug(`[MatchDatabase] Cache HIT for live matches`);
        return cached;
      }
      */

      logger.info(`🔍 [MatchDatabase] Cache MISS - querying live matches from DATABASE...`);

      // Phase 5-S Fix: Removed "should be live" reconciliation from /live endpoint
      // "Should be live" matches are now handled by watchdog and exposed via /api/matches/should-be-live
      // This keeps /live endpoint strict, fast, and contract-compliant

      // CRITICAL FIX (2026-01-09): Removed 4-hour time window restriction
      // Status filter (2,3,4,5,7) is sufficient to identify live matches
      // Time window was causing matches to disappear prematurely:
      // - Example: Matches starting at 08:00 disappeared at 12:00 even if still LIVE
      // - Overtime matches can exceed 4 hours
      // - API documentation doesn't mention time window requirement
      // Now only excluding future matches (match_time <= now) as safeguard
      const nowTs = Math.floor(Date.now() / 1000);

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
          COALESCE(m.home_score_display, m.home_score_regular, 0) as home_score,
          COALESCE(m.away_score_display, m.away_score_regular, 0) as away_score,
          m.home_score_overtime,
          m.away_score_overtime,
          m.home_score_penalties,
          m.away_score_penalties,
          COALESCE(m.home_score_display, m.home_score_regular, 0) as home_score_display,
          COALESCE(m.away_score_display, m.away_score_regular, 0) as away_score_display,
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
          c.country_id as competition_country_id,
          co.name as competition_country_name${includeAI ? `,
          -- AI Prediction (PHASE 1: Latest prediction per match)
          p.id as ai_id,
          p.canonical_bot_name,
          p.prediction,
          p.prediction_threshold,
          p.result as ai_result,
          p.result_reason,
          p.final_score as ai_final_score,
          p.access_type,
          p.minute_at_prediction,
          p.score_at_prediction,
          p.created_at as ai_created_at,
          p.resulted_at` : ''}
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        LEFT JOIN ts_countries co ON c.country_id = co.external_id${includeAI ? `
        -- PHASE 1: LEFT JOIN LATERAL for latest AI prediction per match
        LEFT JOIN LATERAL (
          SELECT id, canonical_bot_name, prediction, prediction_threshold, result,
                 result_reason, final_score, access_type, minute_at_prediction,
                 score_at_prediction, created_at, resulted_at
          FROM ai_predictions
          WHERE match_id = m.external_id
          ORDER BY created_at DESC
          LIMIT 1
        ) p ON true` : ''}
        WHERE m.status_id IN (2, 3, 4, 5, 7)  -- CRITICAL: ONLY strictly live matches (no finished/interrupted)
          AND m.match_time <= $1  -- CRITICAL: Exclude future matches (safeguard)
        ORDER BY
          -- Live matches first (by minute descending), then by competition name
          CASE WHEN m.status_id IN (2, 3, 4, 5, 7) THEN COALESCE(m.minute, 0) ELSE 0 END DESC,
          c.name ASC,
          m.match_time DESC
      `;

      const result = await pool.query(query, [nowTs]);
      const matches = result.rows || [];

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1eefcedf-7c6a-4338-ae7b-79041647f89f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'matchDatabase.service.ts:274',message:'getLiveMatches query result',data:{matchCount:matches.length,queryDuration:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      logger.info(`✅ [MatchDatabase] Found ${matches.length} strictly live matches in database (status_id IN 2,3,4,5,7, NO TIME WINDOW)`);

      // CRITICAL FIX (2026-01-17): Cache SET disabled for debugging
      // TODO: Re-enable after fixing cache invalidation
      /*
      liveMatchCache.setLiveMatches(response);
      */

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

        // CRITICAL FIX: Generate minute_text from minute and status_id
        const minute = (row.minute !== null && row.minute !== undefined) ? Number(row.minute) : null;
        const minuteText = generateMinuteText(minute, validatedStatus);

        // PHASE 1: Map AI prediction fields if present
        const aiPrediction = (includeAI && row.ai_id) ? {
          id: row.ai_id,
          canonical_bot_name: row.canonical_bot_name,
          prediction: row.prediction,
          prediction_threshold: row.prediction_threshold,
          result: row.ai_result,
          result_reason: row.result_reason,
          final_score: row.ai_final_score,
          access_type: row.access_type,
          minute_at_prediction: row.minute_at_prediction,
          score_at_prediction: row.score_at_prediction,
          created_at: row.ai_created_at,
          resulted_at: row.resulted_at,
        } : undefined;

        return {
          id: row.id,
          competition_id: row.competition_id,
          season_id: row.season_id,
          match_time: row.match_time,
          status_id: validatedStatus,
          status: validatedStatus,
          minute: minute, // CRITICAL: Include minute field
          minute_text: minuteText, // CRITICAL FIX: Include minute_text field (Phase 4-4 contract)
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
            country_name: row.competition_country_name || null,
          } : null,
          home_team_name: row.home_team_name || null,
          away_team_name: row.away_team_name || null,
          // PHASE 1: AI Prediction (optional field)
          ...(aiPrediction ? { aiPrediction } : {}),
        };
      });

      // CRITICAL FIX: API fallback removed - only use DB matches
      // All live matches should be in DB (synced by MatchSyncWorker, Watchdog, ProactiveCheck)

      const response: MatchDiaryResponse = {
        results: transformedMatches as any,
      };

      // Phase 6: Smart Cache - Store in cache with short TTL (event-driven invalidation)
      liveMatchCache.setLiveMatches(response);
      logger.debug(`[MatchDatabase] Cache SET - ${transformedMatches.length} live matches`);

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
      // CRITICAL FIX: Increase maxMinutesAgo limit to 1440 (24 hours) to match findShouldBeLiveMatches
      // Previous limit of 240 (4 hours) was too restrictive and missed matches that started many hours ago
      const safeMaxMinutesAgo = Math.min(Math.max(1, maxMinutesAgo), 1440);
      const safeLimit = Math.min(Math.max(1, limit), 500);

      const now = Math.floor(Date.now() / 1000);
      const minTime = now - (safeMaxMinutesAgo * 60);
      
      // CRITICAL FIX: Use TSİ-based today start (same as findShouldBeLiveMatches)
      // This ensures consistency between MatchWatchdogWorker and API endpoint
      const TSI_OFFSET_SECONDS = 3 * 3600;
      const nowDate = new Date(now * 1000);
      const year = nowDate.getUTCFullYear();
      const month = nowDate.getUTCMonth();
      const day = nowDate.getUTCDate();
      // TSİ midnight = UTC midnight - 3 hours
      const todayStart = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
      
      // CRITICAL FIX: Use max of todayStart and minTime to ensure we catch all today's matches
      // This matches the logic in findShouldBeLiveMatches
      const effectiveMinTime = Math.max(minTime, todayStart);

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
          COALESCE(m.home_score_display, m.home_score_regular, 0) as home_score,
          COALESCE(m.away_score_display, m.away_score_regular, 0) as away_score,
          m.home_score_overtime,
          m.away_score_overtime,
          m.home_score_penalties,
          m.away_score_penalties,
          COALESCE(m.home_score_display, m.home_score_regular, 0) as home_score_display,
          COALESCE(m.away_score_display, m.away_score_regular, 0) as away_score_display,
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
          c.country_id as competition_country_id,
          co.name as competition_country_name
        FROM ts_matches m
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        LEFT JOIN ts_countries co ON c.country_id = co.external_id
        WHERE m.status_id = 1  -- NOT_STARTED
          AND m.match_time <= $1  -- match_time has passed
          AND m.match_time >= $2  -- Today's matches (TSİ-based) or maxMinutesAgo window
        ORDER BY m.match_time DESC
        LIMIT $3
      `;

      const result = await pool.query(query, [now, effectiveMinTime, safeLimit]);
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
            country_name: row.competition_country_name || null,
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

/**
 * Match Controller
 * 
 * Handles HTTP requests/responses for match-related endpoints
 * NO business logic here - only request/response handling
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { MatchRecentService } from '../services/thesports/match/matchRecent.service';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchDatabaseService } from '../services/thesports/match/matchDatabase.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { MatchSeasonRecentService } from '../services/thesports/match/matchSeasonRecent.service';
import { MatchLineupService } from '../services/thesports/match/matchLineup.service';
import { MatchTeamStatsService } from '../services/thesports/match/matchTeamStats.service';
import { MatchPlayerStatsService } from '../services/thesports/match/matchPlayerStats.service';
import { MatchAnalysisService } from '../services/thesports/match/matchAnalysis.service';
import { MatchTrendService } from '../services/thesports/match/matchTrend.service';
import { MatchHalfStatsService } from '../services/thesports/match/matchHalfStats.service';
import { SeasonStandingsService } from '../services/thesports/season/standings.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { CombinedStatsService } from '../services/thesports/match/combinedStats.service';
import { MatchRecentParams, MatchDiaryParams, MatchDetailLiveParams, MatchSeasonRecentParams, MatchLineupParams, MatchTeamStatsParams, MatchPlayerStatsParams, MatchAnalysisParams, MatchTrendParams, MatchHalfStatsParams } from '../types/thesports/match';
import { SeasonStandingsParams } from '../types/thesports/season/seasonStandings.types';
import { logger } from '../utils/logger';
import { generateMinuteText } from '../utils/matchMinuteText';

// Initialize services
const theSportsClient = new TheSportsClient();
const matchRecentService = new MatchRecentService(theSportsClient);
const matchDiaryService = new MatchDiaryService(theSportsClient);
const matchDatabaseService = new MatchDatabaseService();
const matchDetailLiveService = new MatchDetailLiveService(theSportsClient);
const matchSeasonRecentService = new MatchSeasonRecentService(theSportsClient);
const matchLineupService = new MatchLineupService(theSportsClient);
const matchTeamStatsService = new MatchTeamStatsService(theSportsClient);
const matchPlayerStatsService = new MatchPlayerStatsService(theSportsClient);
const matchAnalysisService = new MatchAnalysisService(theSportsClient);
const matchTrendService = new MatchTrendService(theSportsClient);
const matchHalfStatsService = new MatchHalfStatsService(theSportsClient);
const seasonStandingsService = new SeasonStandingsService(theSportsClient);
const teamDataService = new TeamDataService(theSportsClient);
const competitionService = new CompetitionService(theSportsClient);
const matchSyncService = new MatchSyncService(teamDataService, competitionService);
const combinedStatsService = new CombinedStatsService(theSportsClient);

// --- Date helpers (TSİ bulletin) ---
const TSI_OFFSET_SECONDS = 3 * 3600;

/**
 * Returns today's date in TSİ (UTC+3) as YYYY-MM-DD and YYYYMMDD.
 * This prevents "wrong day" when the server runs in UTC.
 */
const getTodayTsi = (): { dbDate: string; apiDate: string } => {
  const tsiMs = Date.now() + TSI_OFFSET_SECONDS * 1000;
  const d = new Date(tsiMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const dbDate = `${yyyy}-${mm}-${dd}`;
  const apiDate = `${yyyy}${mm}${dd}`;
  return { dbDate, apiDate };
};

/**
 * Normalize an incoming date (YYYY-MM-DD or YYYYMMDD) into:
 * - dbDate: YYYY-MM-DD
 * - apiDate: YYYYMMDD (TheSports /match/diary expects this)
 */
const normalizeDiaryDate = (
  input?: string
): { dbDate: string; apiDate: string } | null => {
  if (!input) return getTodayTsi();

  const raw = String(input).trim();

  // YYYYMMDD
  if (/^\d{8}$/.test(raw)) {
    const dbDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return { dbDate, apiDate: raw };
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const apiDate = raw.replace(/-/g, '');
    return { dbDate: raw, apiDate };
  }

  return null;
};

/**
 * Get match recent list
 * GET /api/matches/recent
 */
export const getMatchRecentList = async (
  request: FastifyRequest<{ Querystring: MatchRecentParams }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { query } = request;
    const params: MatchRecentParams = {
      page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
      limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
      competition_id: query.competition_id,
      season_id: query.season_id,
      date: query.date,
    };

    const result = await matchRecentService.getMatchRecentList(params);

    // Phase 4-4: Normalize all matches to ensure minute_text is always present (never null)
    const normalizeMatch = (match: any) => {
      const statusId = match.status_id ?? match.status ?? match.match_status ?? 1;
      const minute = match.minute !== null && match.minute !== undefined ? Number(match.minute) : null;
      const minuteText = generateMinuteText(minute, statusId);

      return {
        ...match,
        // Phase 4-4: CRITICAL - Always generate minute_text, never forward null from API/DB
        minute_text: minuteText,
        minute: minute,
        status: statusId,
        status_id: statusId,
        match_status: statusId,
      };
    };

    const normalizedResults = (result.results || []).map(normalizeMatch);

    reply.send({
      success: true,
      data: {
        ...result,
        results: normalizedResults,
      },
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match diary
 * GET /api/matches/diary
 * CRITICAL: DB-only mode - queries database ONLY, no API fallback
 * API calls should only happen in sync workers (DailyMatchSyncWorker, etc.)
 */
export const getMatchDiary = async (
  request: FastifyRequest<{ Querystring: MatchDiaryParams }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { query } = request;
    const normalizedDate = normalizeDiaryDate(query.date as any);

    if (!normalizedDate) {
      reply.status(400).send({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD or YYYYMMDD.',
      });
      return;
    }

    const { dbDate, apiDate } = normalizedDate;

    const normalizeDbMatch = (row: any) => {
      const externalId = row.external_id ?? row.match_id ?? row.id;
      const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;

      const homeScoreRegular = row.home_score_regular ?? row.home_score ?? 0;
      const awayScoreRegular = row.away_score_regular ?? row.away_score ?? 0;

      // Phase 3C: Read minute from DB and generate minute_text
      const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
      const minuteText = generateMinuteText(minute, statusId);

      return {
        // Keep DB uuid `id` if present, but also expose TheSports match id as `external_id` and `match_id`
        ...row,
        external_id: externalId,
        match_id: externalId,
        // Frontend expects `status` (and sometimes `match_status`) not `status_id`
        status: statusId,
        match_status: statusId,
        status_id: statusId,
        // Frontend expects score fields as `home_score`/`away_score` and also reads *_regular
        home_score_regular: row.home_score_regular ?? homeScoreRegular,
        away_score_regular: row.away_score_regular ?? awayScoreRegular,
        home_score: row.home_score ?? homeScoreRegular,
        away_score: row.away_score ?? awayScoreRegular,
        // Phase 4-4: Backend-provided minute and minute_text (ALWAYS generated, never forward DB null)
        minute: minute,
        minute_text: minuteText, // CRITICAL: Override any DB minute_text (never forward null)
        // Kickoff time (kept for backward compatibility, but frontend should not use for calculation)
        live_kickoff_time: row.live_kickoff_time ?? row.match_time ?? null,
        // Ensure numeric incident fields are not undefined
        home_red_cards: row.home_red_cards ?? null,
        away_red_cards: row.away_red_cards ?? null,
        home_yellow_cards: row.home_yellow_cards ?? null,
        away_yellow_cards: row.away_yellow_cards ?? null,
        home_corners: row.home_corners ?? null,
        away_corners: row.away_corners ?? null,
      };
    };

    // Step 1: Query from database ONLY (DB-only mode)
    // CRITICAL: No API fallback - if DB is empty, return empty results
    const dbResult = await matchDatabaseService.getMatchesByDate(dbDate);

    // Step 2: Return database results (even if empty)
    const normalized = (dbResult.results || []).map(normalizeDbMatch);

    logger.info(`📊 [MatchDiary] Returning ${normalized.length} matches from database for ${dbDate} (DB-only mode, no API fallback)`);

    reply.send({
      success: true,
      data: {
        ...dbResult,
        results: normalized,
      },
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get single match by ID
 * GET /api/matches/:match_id
 * Fetches match from database by external_id
 */
export const getMatchById = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    
    const { pool } = await import('../database/connection');
    const client = await pool.connect();
    
    try {
      // Query match with JOINs for teams and competitions (same format as getMatchesByDate)
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
          COALESCE(
            CASE 
              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time 
              THEN m.live_kickoff_time 
              ELSE m.match_time 
            END,
            m.match_time
          ) as live_kickoff_time,
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
        WHERE m.external_id = $1
      `;

      const result = await client.query(query, [match_id]);
      
      if (result.rows.length === 0) {
        reply.status(404).send({
          success: false,
          message: 'Match not found',
        });
        return;
      }

      const row = result.rows[0];
      const { generateMinuteText } = await import('../utils/matchMinuteText');
      
      // Validate status (future match cannot be END)
      let validatedStatus = row.status_id ?? 0;
      const now = Math.floor(Date.now() / 1000);
      const matchTime = row.match_time;

      if (matchTime && matchTime > now) {
        if (validatedStatus === 8 || validatedStatus === 12) {
          validatedStatus = 1; // NOT_STARTED
        }
      }

      const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
      const minuteText = generateMinuteText(minute, validatedStatus);

      const match = {
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
        minute: minute,
        minute_text: minuteText,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        home_team: row.home_team_name ? {
          id: row.home_team_id,
          name: row.home_team_name,
          logo_url: row.home_team_logo,
        } : null,
        away_team: row.away_team_name ? {
          id: row.away_team_id,
          name: row.away_team_name,
          logo_url: row.away_team_logo,
        } : null,
        competition: row.competition_name ? {
          id: row.competition_id,
          name: row.competition_name,
          logo_url: row.competition_logo,
          country_id: row.competition_country_id,
        } : null,
      };

      reply.send({
        success: true,
        data: match,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchById:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match detail live (incidents, stats, score)
 * GET /api/matches/:match_id/detail-live
 * 
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
export const getMatchDetailLive = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // Check if match is finished
    const isFinished = await combinedStatsService.isMatchFinished(match_id);
    
    // For FINISHED matches, return from database
    if (isFinished) {
      const dbResult = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
      
      if (dbResult && (dbResult.incidents.length > 0 || dbResult.allStats.length > 0)) {
        logger.debug(`[MatchController] Match finished, returning detail-live from DB for ${match_id}`);
        reply.send({
          success: true,
          data: {
            results: [{
              id: match_id,
              incidents: dbResult.incidents,
              stats: dbResult.allStats,
              score: dbResult.score,
            }],
            source: 'database (match finished)'
          },
        });
        return;
      }
    }

    // Fetch from API
    const params: MatchDetailLiveParams = { match_id };
    const result = await matchDetailLiveService.getMatchDetailLive(params);

    // Save incidents to database (merge with existing stats)
    if (result?.results && Array.isArray(result.results)) {
      const matchData = result.results.find((r: any) => r.id === match_id) || result.results[0];
      if (matchData?.incidents?.length > 0) {
        // Get existing stats and merge with incidents
        const existingStats = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
        if (existingStats) {
          existingStats.incidents = matchData.incidents;
          existingStats.score = matchData.score || existingStats.score;
          combinedStatsService.saveCombinedStatsToDatabase(match_id, existingStats).catch(err => {
            logger.error(`[MatchController] Failed to save incidents to DB for ${match_id}:`, err);
          });
        } else {
          // Create new entry with incidents
          const newStats = {
            matchId: match_id,
            basicStats: [],
            detailedStats: [],
            allStats: [],
            incidents: matchData.incidents,
            score: matchData.score || null,
            lastUpdated: Date.now(),
          };
          combinedStatsService.saveCombinedStatsToDatabase(match_id, newStats).catch(err => {
            logger.error(`[MatchController] Failed to save incidents to DB for ${match_id}:`, err);
          });
        }
      }
    }

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchDetailLive:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match season recent
 * GET /api/matches/season/recent
 */
export const getMatchSeasonRecent = async (
  request: FastifyRequest<{ Querystring: MatchSeasonRecentParams }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { query } = request;
    const params: MatchSeasonRecentParams = {
      season_id: String(query.season_id),
      page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
      limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
    };

    const result = await matchSeasonRecentService.getMatchSeasonRecent(params);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match lineup
 * GET /api/matches/:match_id/lineup
 */
export const getMatchLineup = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchLineupParams = { match_id };

    const result = await matchLineupService.getMatchLineup(params);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match team stats
 * GET /api/matches/:match_id/team-stats
 */
export const getMatchTeamStats = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchTeamStatsParams = { match_id };

    const result = await matchTeamStatsService.getMatchTeamStats(params);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get should-be-live matches (ops/debug endpoint)
 * GET /api/matches/should-be-live?maxMinutesAgo=120
 * 
 * Phase 5-S: Returns matches with status_id=1 but match_time has passed.
 * These are candidates for watchdog reconciliation.
 * NOT used by frontend live view - only for ops/debug visibility.
 */
export const getShouldBeLiveMatches = async (
  request: FastifyRequest<{ Querystring: { maxMinutesAgo?: string; limit?: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const maxMinutesAgo = request.query.maxMinutesAgo ? parseInt(request.query.maxMinutesAgo, 10) : 120;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 200;

    const result = await matchDatabaseService.getShouldBeLiveMatches(maxMinutesAgo, limit);

    // Normalize results (same as getLiveMatches)
    const normalizeDbMatch = (row: any) => {
      const externalId = row.external_id ?? row.match_id ?? row.id;
      const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;
      const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
      const minuteText = generateMinuteText(minute, statusId);

      return {
        ...row,
        external_id: externalId,
        match_id: externalId,
        status: statusId,
        match_status: statusId,
        status_id: statusId,
        minute: minute,
        minute_text: minuteText, // Phase 4-4: Always generate minute_text
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      };
    };

    const normalized = (result.results || []).map(normalizeDbMatch);

    reply.send({
      success: true,
      data: {
        results: normalized,
        total: normalized.length,
        maxMinutesAgo,
        limit,
      },
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getShouldBeLiveMatches:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match player stats
 * GET /api/matches/:match_id/player-stats
 */
export const getMatchPlayerStats = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchPlayerStatsParams = { match_id };

    const result = await matchPlayerStatsService.getMatchPlayerStats(params);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get matches in "now window" (time-window endpoint, NOT strict live-only)
 * GET /api/matches/live
 * 
 * SEMANTICS: This endpoint returns matches in a time window (not strict live-only):
 * - Returns matches with status_id IN (2, 3, 4, 5, 7) (explicitly live)
 * - ALSO returns matches with status_id = 1 (NOT_STARTED) if match_time has passed (within today's window)
 * - Purpose: Catch matches that should have started but status hasn't updated yet
 * - NO date filtering - only status and time-based filtering
 * 
 * PHASE 3C COMPLETE — Minute & Watchdog logic frozen
 * No further changes allowed without Phase 4+ approval.
 */
export const getLiveMatches = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const normalizeDbMatch = (row: any) => {
      const externalId = row.external_id ?? row.match_id ?? row.id;
      const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;

      const homeScoreRegular = row.home_score_regular ?? row.home_score ?? 0;
      const awayScoreRegular = row.away_score_regular ?? row.away_score ?? 0;

      // Phase 3C: Read minute from DB and generate minute_text
      const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
      const minuteText = generateMinuteText(minute, statusId);

      return {
        ...row,
        external_id: externalId,
        match_id: externalId,
        status: statusId,
        match_status: statusId,
        status_id: statusId,
        home_score_regular: row.home_score_regular ?? homeScoreRegular,
        away_score_regular: row.away_score_regular ?? awayScoreRegular,
        home_score: row.home_score ?? homeScoreRegular,
        away_score: row.away_score ?? awayScoreRegular,
        // Phase 4-4: Backend-provided minute and minute_text (ALWAYS generated, never forward DB null)
        minute: minute,
        minute_text: minuteText, // CRITICAL: Override any DB minute_text (never forward null)
        // Kickoff time (kept for backward compatibility, but frontend should not use for calculation)
        live_kickoff_time: row.live_kickoff_time ?? row.match_time ?? null,
        home_red_cards: row.home_red_cards ?? null,
        away_red_cards: row.away_red_cards ?? null,
        home_yellow_cards: row.home_yellow_cards ?? null,
        away_yellow_cards: row.away_yellow_cards ?? null,
        home_corners: row.home_corners ?? null,
        away_corners: row.away_corners ?? null,
      };
    };

    const dbResult = await matchDatabaseService.getLiveMatches();
    const normalized = dbResult.results.map(normalizeDbMatch);

    reply.send({
      success: true,
      data: {
        ...dbResult,
        results: normalized,
      },
    });
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match analysis (H2H)
 * GET /api/matches/:match_id/analysis
 */
export const getMatchAnalysis = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchAnalysisParams = { match_id };

    const result = await matchAnalysisService.getMatchAnalysis(params);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchAnalysis:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match trend (minute-by-minute data)
 * GET /api/matches/:match_id/trend
 * 
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
export const getMatchTrend = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchTrendParams = { match_id };

    // Get match status from database
    const { pool } = await import('../database/connection');
    const client = await pool.connect();
    let matchStatus: number | undefined;
    try {
      const result = await client.query(
        'SELECT status_id FROM ts_matches WHERE external_id = $1',
        [match_id]
      );
      if (result.rows.length > 0) {
        matchStatus = result.rows[0].status_id;
      }
    } finally {
      client.release();
    }

    const isFinished = matchStatus === 8;

    // For FINISHED matches, return from database first
    if (isFinished) {
      const dbTrend = await getTrendFromDatabase(match_id);
      
      if (dbTrend && dbTrend.results && dbTrend.results.length > 0) {
        logger.debug(`[MatchController] Match finished, returning trend from DB for ${match_id}`);
        reply.send({
          success: true,
          data: {
            ...dbTrend,
            source: 'database (match finished)'
          },
        });
        return;
      }
    }

    // Fetch from API
    const result = await matchTrendService.getMatchTrend(params, matchStatus);

    // Save trend data to database for persistence
    if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
      saveTrendToDatabase(match_id, result).catch(err => {
        logger.error(`[MatchController] Failed to save trend to DB for ${match_id}:`, err);
      });
    }

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchTrend:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// Helper function to get trend from database
async function getTrendFromDatabase(matchId: string): Promise<any | null> {
  const { pool } = await import('../database/connection');
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT statistics->'trend' as trend
      FROM ts_matches
      WHERE external_id = $1
        AND statistics->'trend' IS NOT NULL
    `, [matchId]);

    if (result.rows.length === 0 || !result.rows[0].trend) {
      return null;
    }

    return result.rows[0].trend;
  } catch (error: any) {
    logger.error(`[MatchController] Error reading trend from database for ${matchId}:`, error);
    return null;
  } finally {
    client.release();
  }
}

// Helper function to save trend to database
async function saveTrendToDatabase(matchId: string, trendData: any): Promise<void> {
  const { pool } = await import('../database/connection');
  const client = await pool.connect();
  try {
    // Get existing statistics
    const existingResult = await client.query(`
      SELECT statistics FROM ts_matches WHERE external_id = $1
    `, [matchId]);
    
    const existingStats = existingResult.rows[0]?.statistics || {};

    // Update only trend field
    const statisticsData = {
      ...existingStats,
      trend: trendData,
      last_updated: Date.now(),
    };

    // Update statistics column
    await client.query(`
      UPDATE ts_matches
      SET statistics = $1::jsonb,
          updated_at = NOW()
      WHERE external_id = $2
    `, [JSON.stringify(statisticsData), matchId]);

    logger.info(`[MatchController] Saved trend data to database for match: ${matchId}`);
  } catch (error: any) {
    logger.error(`[MatchController] Error saving trend to database for ${matchId}:`, error);
  } finally {
    client.release();
  }
}

/**
 * Get match half stats (first half / second half breakdown)
 * GET /api/matches/:match_id/half-stats
 * 
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
export const getMatchHalfStats = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // Check if match is finished
    const isFinished = await combinedStatsService.isMatchFinished(match_id);
    
    // For FINISHED matches, ALWAYS try database first
    if (isFinished) {
      const dbHalfStats = await combinedStatsService.getHalfTimeStatsFromDatabase(match_id);
      
      if (dbHalfStats) {
        logger.debug(`[MatchController] Match finished, returning half-stats from DB for ${match_id}`);
        reply.send({
          success: true,
          data: {
            results: [
              { Sign: 'ft', ...convertStatsArrayToObject(dbHalfStats.fullTime) },
              { Sign: 'p1', ...convertStatsArrayToObject(dbHalfStats.firstHalf) },
              { Sign: 'p2', ...convertStatsArrayToObject(dbHalfStats.secondHalf) },
            ],
            source: 'database (match finished)'
          },
        });
        return;
      }
      
      logger.warn(`[MatchController] Match finished but no half-stats in DB for ${match_id}, trying API`);
    }

    // Fetch from API
    const params: MatchHalfStatsParams = { match_id };
    const result = await matchHalfStatsService.getMatchHalfStatsDetail(params);

    // Parse and save half-time stats to database
    if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
      try {
        const halfTimeStats = parseHalfTimeStatsFromApiResponse(result.results);
        if (halfTimeStats) {
          combinedStatsService.saveHalfTimeStatsToDatabase(match_id, halfTimeStats).catch(err => {
            logger.error(`[MatchController] Failed to save half-stats to DB for ${match_id}:`, err);
          });
        }
      } catch (parseErr) {
        logger.warn(`[MatchController] Failed to parse half-stats for ${match_id}:`, parseErr);
      }
    }

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchHalfStats:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// Helper function to convert stats array to object format for API response
function convertStatsArrayToObject(stats: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  if (!stats || !Array.isArray(stats)) return result;
  
  for (const stat of stats) {
    if (stat.type !== undefined) {
      result[String(stat.type)] = [stat.home ?? 0, stat.away ?? 0];
    }
  }
  return result;
}

// Helper function to parse half-time stats from API response
function parseHalfTimeStatsFromApiResponse(results: any[]): { firstHalf: any[]; secondHalf: any[]; fullTime: any[] } | null {
  if (!results || !Array.isArray(results)) return null;
  
  const firstHalf: any[] = [];
  const secondHalf: any[] = [];
  const fullTime: any[] = [];
  
  for (const item of results) {
    const sign = item.Sign;
    if (!sign) continue;
    
    const stats: any[] = [];
    for (const [key, value] of Object.entries(item)) {
      if (key === 'Sign') continue;
      const typeId = Number(key);
      if (isNaN(typeId)) continue;
      
      const values = Array.isArray(value) ? value : [];
      if (values.length >= 2) {
        stats.push({
          type: typeId,
          home: values[0] ?? 0,
          away: values[1] ?? 0,
        });
      }
    }
    
    if (sign === 'p1') {
      firstHalf.push(...stats);
    } else if (sign === 'p2') {
      secondHalf.push(...stats);
    } else if (sign === 'ft') {
      fullTime.push(...stats);
    }
  }
  
  return { firstHalf, secondHalf, fullTime };
}

/**
 * Get season standings
 * GET /api/seasons/:season_id/standings
 */
export const getSeasonStandings = async (
  request: FastifyRequest<{ Params: { season_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { season_id } = request.params;
    const params: SeasonStandingsParams = { season_id };

    const result = await seasonStandingsService.getSeasonStandings(params);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getSeasonStandings:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match live stats (COMBINED from /match/detail_live AND /match/team_stats)
 * GET /api/matches/:match_id/live-stats
 * Returns combined stats from:
 * 1. Real-time Data (corner, cards, shots, attacks, possession)
 * 2. Match Team Statistics (passes, tackles, interceptions, crosses)
 * 
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
export const getMatchLiveStats = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // Check if match is finished
    const isFinished = await combinedStatsService.isMatchFinished(match_id);
    
    // For FINISHED matches, ALWAYS use database (API doesn't return data after match ends)
    if (isFinished) {
      const dbResult = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
      
      if (dbResult && dbResult.allStats.length > 0) {
        logger.debug(`[MatchController] Match finished, returning stats from DB for ${match_id}`);
        reply.send({
          success: true,
          data: {
            match_id: dbResult.matchId,
            stats: dbResult.allStats,
            fullTime: {
              stats: dbResult.allStats,
              results: dbResult.allStats,
            },
            halfTime: dbResult.halfTimeStats || null,
            incidents: dbResult.incidents,
            score: dbResult.score,
            sources: {
              basic: dbResult.basicStats.length,
              detailed: dbResult.detailedStats.length,
              from: 'database (match finished)'
            },
          },
        });
        return;
      }
      
      // Finished but no DB data - try API as last resort
      logger.warn(`[MatchController] Match finished but no DB data, trying API for ${match_id}`);
    }

    // For LIVE matches: Try DB first, then API
    let result = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
    
    if (result && result.allStats.length > 0 && !isFinished) {
      // Found in DB for live match - but still refresh from API periodically
      // Return DB data and refresh in background
      logger.debug(`[MatchController] Returning stats from DB for live match ${match_id}`);
      
      // Background refresh from API
      combinedStatsService.getCombinedMatchStats(match_id).then(apiResult => {
        if (apiResult && apiResult.allStats.length > 0) {
          combinedStatsService.saveCombinedStatsToDatabase(match_id, apiResult).catch(err => {
            logger.error(`[MatchController] Background save failed for ${match_id}:`, err);
          });
        }
      }).catch(err => {
        logger.warn(`[MatchController] Background refresh failed for ${match_id}:`, err);
      });
      
      reply.send({
        success: true,
        data: {
          match_id: result.matchId,
          stats: result.allStats,
          fullTime: {
            stats: result.allStats,
            results: result.allStats,
          },
          halfTime: result.halfTimeStats || null,
          incidents: result.incidents,
          score: result.score,
          sources: {
            basic: result.basicStats.length,
            detailed: result.detailedStats.length,
            from: 'database'
          },
        },
      });
      return;
    }

    // Fetch from API
    logger.info(`[MatchController] Fetching stats from API for ${match_id}`);
    result = await combinedStatsService.getCombinedMatchStats(match_id);

    // Save to database (CRITICAL for persistence after match ends)
    if (result && result.allStats.length > 0) {
      combinedStatsService.saveCombinedStatsToDatabase(match_id, result).catch((err) => {
        logger.error(`[MatchController] Failed to save stats to DB for ${match_id}:`, err);
      });
    }

    reply.send({
      success: true,
      data: {
        match_id: result.matchId,
        stats: result.allStats,
        fullTime: {
          stats: result.allStats,
          results: result.allStats,
        },
        halfTime: result.halfTimeStats || null,
        incidents: result.incidents,
        score: result.score,
        sources: {
          basic: result.basicStats.length,
          detailed: result.detailedStats.length,
          from: 'api'
        },
      },
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchLiveStats:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Trigger pre-sync for today's matches
 * POST /api/admin/pre-sync
 * Syncs H2H, lineups, standings, and compensation data
 */
export const triggerPreSync = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { DailyPreSyncService } = await import('../services/thesports/sync/dailyPreSync.service');
    const preSyncService = new DailyPreSyncService(theSportsClient);

    // Get today's matches from database
    const today = new Date().toISOString().split('T')[0];
    const dbResult = await matchDatabaseService.getMatchesByDate(today);
    const matches = dbResult.results || [];

    const matchIds = matches.map((m: any) => m.external_id || m.id).filter(Boolean);
    const seasonIds = matches.map((m: any) => m.season_id).filter(Boolean);

    logger.info(`Triggering pre-sync for ${matchIds.length} matches, ${seasonIds.length} seasons`);

    const result = await preSyncService.runPreSync(matchIds, seasonIds);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in triggerPreSync:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get H2H data (reads from database first, then API fallback)
 * GET /api/matches/:match_id/h2h
 */
export const getMatchH2H = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // Try database first
    const { DailyPreSyncService } = await import('../services/thesports/sync/dailyPreSync.service');
    const preSyncService = new DailyPreSyncService(theSportsClient);

    let h2hData = await preSyncService.getH2HFromDb(match_id);

    // If not in DB, try API and save
    if (!h2hData) {
      logger.info(`H2H not in DB for ${match_id}, fetching from API`);
      await preSyncService.syncH2HToDb(match_id);
      h2hData = await preSyncService.getH2HFromDb(match_id);
    }

    if (h2hData) {
      reply.send({
        success: true,
        data: {
          summary: {
            total: h2hData.total_matches,
            homeWins: h2hData.home_wins,
            draws: h2hData.draws,
            awayWins: h2hData.away_wins,
          },
          h2hMatches: h2hData.h2h_matches || [],
          homeRecentForm: h2hData.home_recent_form || [],
          awayRecentForm: h2hData.away_recent_form || [],
        },
      });
    } else {
      reply.send({
        success: true,
        data: null,
        message: 'No H2H data available for this match',
      });
    }
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchH2H:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

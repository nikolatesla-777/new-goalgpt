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
 * Get match detail live
 * GET /api/matches/:match_id/detail-live
 */
export const getMatchDetailLive = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchDetailLiveParams = { match_id };

    const result = await matchDetailLiveService.getMatchDetailLive(params);

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
 * Get match trend (live or detail)
 * GET /api/matches/:match_id/trend
 */
export const getMatchTrend = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchTrendParams = { match_id };

    const result = await matchTrendService.getMatchTrendDetail(params);

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

/**
 * Get match half stats
 * GET /api/matches/:match_id/half-stats
 */
export const getMatchHalfStats = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;
    const params: MatchHalfStatsParams = { match_id };

    const result = await matchHalfStatsService.getMatchHalfStatsDetail(params);

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
 */
export const getMatchLiveStats = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // Fetch BOTH data sources in parallel
    const [liveStats, teamStatsResponse] = await Promise.all([
      matchDetailLiveService.getMatchStatsFromLive(match_id).catch(err => {
        logger.warn(`[CombinedStats] detail_live failed for ${match_id}:`, err.message);
        return null;
      }),
      matchTeamStatsService.getMatchTeamStats({ match_id }).catch(err => {
        logger.warn(`[CombinedStats] team_stats failed for ${match_id}:`, err.message);
        return null;
      }),
    ]);

    // Merge stats from both sources
    const statsMap = new Map<number, { type: number; home: number; away: number }>();

    // 1. Add real-time stats (detail_live) - lower priority
    if (liveStats?.stats && Array.isArray(liveStats.stats)) {
      for (const stat of liveStats.stats) {
        if (stat.type !== undefined) {
          statsMap.set(stat.type, {
            type: stat.type,
            home: stat.home ?? 0,
            away: stat.away ?? 0,
          });
        }
      }
    }

    // 2. Add/override with team stats (team_stats/detail) - higher priority (more detailed)
    // Handle multiple response formats: results[], result.stats, or results[0].stats
    let teamStatsArray: any[] = [];
    if (teamStatsResponse) {
      const resp = teamStatsResponse as any;
      if (resp.result?.stats && Array.isArray(resp.result.stats)) {
        teamStatsArray = resp.result.stats;
      } else if (resp.results && Array.isArray(resp.results)) {
        // Find match in results array
        const matchData = resp.results.find((r: any) => r.id === match_id || r.match_id === match_id);
        if (matchData?.stats && Array.isArray(matchData.stats)) {
          teamStatsArray = matchData.stats;
        } else if (resp.results[0]?.stats && Array.isArray(resp.results[0].stats)) {
          teamStatsArray = resp.results[0].stats;
        }
      }
    }
    if (Array.isArray(teamStatsArray)) {
      for (const stat of teamStatsArray) {
        if (stat.type !== undefined) {
          statsMap.set(stat.type, {
            type: stat.type,
            home: stat.home ?? 0,
            away: stat.away ?? 0,
          });
        }
      }
    }

    // Convert map to sorted array (by type)
    const combinedStats = Array.from(statsMap.values()).sort((a, b) => a.type - b.type);

    logger.info(`[CombinedStats] ${match_id}: detail_live=${liveStats?.stats?.length || 0}, team_stats=${teamStatsArray.length}, combined=${combinedStats.length}`);

    reply.send({
      success: true,
      data: {
        match_id: liveStats?.id || match_id,
        stats: combinedStats,
        incidents: liveStats?.incidents || [],
        score: liveStats?.score || null,
        sources: {
          detail_live: liveStats?.stats?.length || 0,
          team_stats: teamStatsArray.length,
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

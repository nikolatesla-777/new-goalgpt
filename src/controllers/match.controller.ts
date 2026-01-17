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
import { matchIncidentsService } from '../services/thesports/match/matchIncidents.service';
import { SeasonStandingsService } from '../services/thesports/season/standings.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { CombinedStatsService } from '../services/thesports/match/combinedStats.service';
import { MatchRecentParams, MatchDiaryParams, MatchDetailLiveParams, MatchSeasonRecentParams, MatchLineupParams, MatchTeamStatsParams, MatchPlayerStatsParams, MatchAnalysisParams, MatchTrendParams, MatchHalfStatsParams } from '../types/thesports/match';
import { SeasonStandingsParams } from '../types/thesports/season/seasonStandings.types';
import { logger } from '../utils/logger';
import { generateMinuteText } from '../utils/matchMinuteText';
import { liveMatchCache } from '../services/thesports/match/liveMatchCache.service';
import { matchStatsRepository } from '../repositories/matchStats.repository';
import { getDiaryCache, setDiaryCache, getSmartTTL } from '../utils/matchCache';
// SINGLETON: Use shared API client instead of creating new instances
import { theSportsAPI } from '../core';

// Initialize services with SINGLETON API client
// Services now use theSportsAPI singleton internally
const matchRecentService = new MatchRecentService();
const matchDiaryService = new MatchDiaryService();
const matchDatabaseService = new MatchDatabaseService();
const matchDetailLiveService = new MatchDetailLiveService();
const matchSeasonRecentService = new MatchSeasonRecentService();
const matchLineupService = new MatchLineupService();
const matchTeamStatsService = new MatchTeamStatsService();
const matchPlayerStatsService = new MatchPlayerStatsService();
const matchAnalysisService = new MatchAnalysisService();
const matchTrendService = new MatchTrendService();
const matchHalfStatsService = new MatchHalfStatsService();
const seasonStandingsService = new SeasonStandingsService();
const teamDataService = new TeamDataService();
const competitionService = new CompetitionService();
const matchSyncService = new MatchSyncService(teamDataService, competitionService);
const combinedStatsService = new CombinedStatsService();

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
  request: FastifyRequest<{ Querystring: MatchDiaryParams & { status?: string } }>,
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

    // CRITICAL FIX: Parse status filter from query parameter
    // status can be a single number or comma-separated list (e.g., "8" or "1,2,3")
    let statusFilter: number[] | undefined;
    if (query.status) {
      try {
        statusFilter = query.status.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (statusFilter.length === 0) {
          statusFilter = undefined;
        }
      } catch (error) {
        logger.warn(`[MatchController] Invalid status filter: ${query.status}`);
      }
    }

    // CACHE: Check cache first
    const cachedData = getDiaryCache(dbDate, statusFilter);
    if (cachedData) {
      // Cache hit - add Cache-Control headers for browser caching
      const ttl = getSmartTTL(dbDate);
      reply.header('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
      reply.header('X-Cache', 'HIT');

      reply.send({
        success: true,
        data: cachedData,
      });
      return;
    }

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
    // CRITICAL FIX: Pass status filter to backend query
    const dbResult = await matchDatabaseService.getMatchesByDate(dbDate, statusFilter);

    // Step 2: Return database results (even if empty)
    const normalized = (dbResult.results || []).map(normalizeDbMatch);

    logger.info(`📊 [MatchDiary] Returning ${normalized.length} matches from database for ${dbDate} (DB-only mode, no API fallback)`);

    // Prepare response data
    const responseData = {
      ...dbResult,
      results: normalized,
    };

    // CACHE: Save to cache for future requests
    setDiaryCache(dbDate, statusFilter, responseData);

    // Add Cache-Control headers for browser caching
    const ttl = getSmartTTL(dbDate);
    reply.header('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
    reply.header('X-Cache', 'MISS');

    reply.send({
      success: true,
      data: responseData,
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
 * 
 * CRITICAL: No cache - always fetches fresh from database
 * Match status can change rapidly, cache would cause stale data
 */
export const getMatchById = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // CRITICAL: Always fetch fresh from database (no cache)
    // Match status changes frequently, cache would cause inconsistencies
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
          -- CRITICAL FIX: Use COALESCE to get score from multiple sources
          -- Priority: home_score_display > home_scores[0] > home_score_regular > 0
          COALESCE(
            m.home_score_display,
            (m.home_scores->0)::INTEGER,
            m.home_score_regular,
            0
          ) as home_score,
          COALESCE(
            m.away_score_display,
            (m.away_scores->0)::INTEGER,
            m.away_score_regular,
            0
          ) as away_score,
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

      // CRITICAL FIX: Validate status and prevent regression
      let validatedStatus = row.status_id ?? 0;
      const now = Math.floor(Date.now() / 1000);
      const matchTime = row.match_time;

      // CRITICAL FIX: Status güncellemesi sadece background worker'lar tarafından yapılmalı
      // getMatchById endpoint'i sadece database'den okur, reconcile yapmaz
      // Bu tutarlılık sağlar: Ana sayfa ve detay sayfası aynı veriyi gösterir
      // Status güncellemesi MatchWatchdogWorker ve DataUpdateWorker tarafından yapılır

      // CRITICAL FIX: Future matches cannot have END status
      if (matchTime && matchTime > now) {
        if (validatedStatus === 8 || validatedStatus === 12) {
          validatedStatus = 1; // NOT_STARTED
          logger.warn(
            `[getMatchById] Future match ${match_id} had END status, corrected to NOT_STARTED`
          );
        }
      }

      const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
      const minuteText = generateMinuteText(minute, validatedStatus);

      // CRITICAL FIX: Extract final score from incidents if score columns are 0-0 but incidents have goals
      // This fixes the issue where header shows 0-0 but Events tab shows correct score from incidents
      let finalHomeScore = row.home_score ?? null;
      let finalAwayScore = row.away_score ?? null;

      // If score is 0-0 or null, try to extract from incidents JSONB
      if ((finalHomeScore === null || finalHomeScore === 0) && (finalAwayScore === null || finalAwayScore === 0)) {
        try {
          const incidentsQuery = await client.query(
            'SELECT incidents FROM ts_matches WHERE external_id = $1',
            [match_id]
          );

          if (incidentsQuery.rows.length > 0 && incidentsQuery.rows[0].incidents) {
            const incidents = incidentsQuery.rows[0].incidents;
            if (Array.isArray(incidents) && incidents.length > 0) {
              // Find the last incident with score information
              for (let i = incidents.length - 1; i >= 0; i--) {
                const incident = incidents[i];
                if (incident && typeof incident === 'object' &&
                  (incident.home_score !== undefined || incident.away_score !== undefined)) {
                  finalHomeScore = incident.home_score ?? finalHomeScore;
                  finalAwayScore = incident.away_score ?? finalAwayScore;
                  logger.info(
                    `[getMatchById] Extracted score from incidents for ${match_id}: ${finalHomeScore}-${finalAwayScore}`
                  );
                  break; // Use the last (most recent) incident with score
                }
              }
            }
          }
        } catch (incidentsError: any) {
          // If incidents extraction fails, use original score
          logger.debug(`[getMatchById] Failed to extract score from incidents for ${match_id}: ${incidentsError.message}`);
        }
      }

      const match = {
        id: row.id,
        competition_id: row.competition_id,
        season_id: row.season_id,
        match_time: row.match_time,
        status_id: validatedStatus,
        status: validatedStatus,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        home_score: finalHomeScore,
        away_score: finalAwayScore,
        home_score_overtime: (row.home_score_overtime ?? 0),
        away_score_overtime: (row.away_score_overtime ?? 0),
        home_score_penalties: (row.home_score_penalties ?? 0),
        away_score_penalties: (row.away_score_penalties ?? 0),
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

      // Finished but no DB data - return empty immediately (don't wait for slow API)
      logger.warn(`[MatchController] Match finished but no DB data for detail-live ${match_id}, returning empty`);
      reply.send({
        success: true,
        data: {
          results: [{ id: match_id, incidents: [], stats: [], score: null }],
          source: 'database (no data available)'
        },
      });
      return;
    }

    // Fetch from API (only for LIVE matches) with 3s timeout
    const params: MatchDetailLiveParams = { match_id };
    let result: any = null;
    try {
      const apiPromise = matchDetailLiveService.getMatchDetailLive(params);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API timeout')), 15000)
      );
      result = await Promise.race([apiPromise, timeoutPromise]);
    } catch (err: any) {
      logger.warn(`[MatchController] detail-live API timeout for ${match_id}: ${err.message}`);
      // Return empty on timeout
      reply.send({
        success: true,
        data: {
          results: [{ id: match_id, incidents: [], stats: [], score: null }],
          source: 'timeout (API too slow)'
        },
      });
      return;
    }

    // Save incidents to database (merge with existing stats)
    if (result?.results && Array.isArray(result.results)) {
      const matchData: any = result.results.find((r: any) => r.id === match_id) || result.results[0];
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
 * Get match lineup (reads from database first, then API fallback)
 * GET /api/matches/:match_id/lineup
 */
export const getMatchLineup = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    // Try database first
    const { DailyPreSyncService } = await import('../services/thesports/sync/dailyPreSync.service');
    const preSyncService = new DailyPreSyncService();

    let lineupData = await preSyncService.getLineupFromDb(match_id);

    // If not in DB, try API and save
    if (!lineupData) {
      logger.info(`Lineup not in DB for ${match_id}, fetching from API`);
      try {
        await preSyncService.syncLineupToDb(match_id);
        lineupData = await preSyncService.getLineupFromDb(match_id);
      } catch (syncError: any) {
        logger.warn(`Failed to sync lineup for ${match_id}: ${syncError.message}`);
        // Continue to API fallback even if sync fails
      }
    }

    // If still no data in DB, try API directly (fallback)
    if (!lineupData) {
      logger.info(`Lineup still not in DB for ${match_id}, trying API directly`);
      const params: MatchLineupParams = { match_id };
      const apiResult = await matchLineupService.getMatchLineup(params);

      reply.send({
        success: true,
        data: apiResult,
      });
      return;
    }

    // Return data from database
    const homeLineup = lineupData.home_lineup || [];
    const awayLineup = lineupData.away_lineup || [];
    const homeSubs = lineupData.home_subs || [];
    const awaySubs = lineupData.away_subs || [];

    reply.send({
      success: true,
      data: {
        code: 0,
        results: {
          home_formation: lineupData.home_formation,
          away_formation: lineupData.away_formation,
          home_lineup: homeLineup,
          away_lineup: awayLineup,
          home_subs: homeSubs,
          away_subs: awaySubs,
          home: homeLineup,
          away: awayLineup,
        },
        source: 'database',
      },
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getMatchLineup:', error);
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
    // CRITICAL FIX (2026-01-17): CACHE DISABLED TEMPORARILY for score debugging
    // Cache was returning stale scores, bypassing to ensure fresh data
    // TODO: Re-enable after fixing cache invalidation on MQTT updates
    /*
    const cachedData = getLiveMatchesCache();
    if (cachedData) {
      reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      reply.header('X-Cache', 'HIT');

      const responseData = {
        matches: cachedData.results || cachedData.matches || [],
        total: (cachedData.results || cachedData.matches || []).length,
        results: cachedData.results || cachedData.matches || [],
      };

      reply.send({
        success: true,
        data: responseData,
      });
      return;
    }
    */

    const normalizeDbMatch = (row: any) => {
      const externalId = row.external_id ?? row.match_id ?? row.id;
      const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;

      // PHASE 6 FIX: Database now returns correct columns (home_score_display)
      // Fallback chain for safety: home_score (from DB) → home_score_display → home_score_regular → 0
      const homeScoreDisplay = row.home_score ?? row.home_score_display ?? row.home_score_regular ?? 0;
      const awayScoreDisplay = row.away_score ?? row.away_score_display ?? row.away_score_regular ?? 0;

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
        home_score_regular: homeScoreDisplay,  // FIXED: Use display score
        away_score_regular: awayScoreDisplay,  // FIXED: Use display score
        home_score: homeScoreDisplay,          // FIXED: Use display score
        away_score: awayScoreDisplay,          // FIXED: Use display score
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

    // Prepare response data with mobile app compatible format
    const responseData = {
      matches: normalized,
      total: normalized.length,
      results: normalized, // Keep for backward compatibility
    };

    // PHASE 6 FIX: Cache disabled - direct database reads only for real-time MQTT scores
    // setLiveMatchesCache(responseData); // REMOVED

    // No browser caching for real-time live scores
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('X-Cache', 'DISABLED');

    reply.send({
      success: true,
      data: responseData,
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
// CRITICAL FIX: Read from trend_data column (not statistics->'trend')
// PostMatchProcessor writes to trend_data column
async function getTrendFromDatabase(matchId: string): Promise<any | null> {
  const { pool } = await import('../database/connection');
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT trend_data
      FROM ts_matches
      WHERE external_id = $1
        AND trend_data IS NOT NULL
    `, [matchId]);

    if (result.rows.length === 0 || !result.rows[0].trend_data) {
      return null;
    }

    // trend_data formatını MatchTrendResponse formatına çevir
    // trend_data is already an array or object, wrap it in results format
    const trendData = result.rows[0].trend_data;

    // If it's already in the correct format, return it
    if (trendData && typeof trendData === 'object') {
      // Check if it's already wrapped in results
      if (Array.isArray(trendData)) {
        return { results: trendData };
      }
      // If it's an object with first_half/second_half, wrap it
      if (trendData.first_half || trendData.second_half) {
        return { results: [trendData] };
      }
      // Otherwise wrap in results array
      return { results: [trendData] };
    }

    return { results: trendData };
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
      const firstHalfStats = await combinedStatsService.getFirstHalfStats(match_id);
      const secondHalfStats = await combinedStatsService.getSecondHalfStats(match_id);

      if (dbResult && dbResult.allStats.length > 0) {
        logger.debug(`[MatchController] Match finished, returning stats from DB for ${match_id}`);
        reply.send({
          success: true,
          data: {
            match_id: dbResult.matchId,
            match_status: 8, // FINISHED
            stats: dbResult.allStats,
            fullTime: {
              stats: dbResult.allStats,
              results: dbResult.allStats,
            },
            firstHalfStats: firstHalfStats || null,
            secondHalfStats: secondHalfStats || null,
            halfTime: dbResult.halfTimeStats || null,
            incidents: dbResult.incidents,
            score: dbResult.score,
            sources: {
              basic: dbResult.basicStats.length,
              detailed: dbResult.detailedStats.length,
              from: 'database (match finished)',
              hasFirstHalfSnapshot: !!firstHalfStats,
              hasSecondHalfSnapshot: !!secondHalfStats,
            },
          },
        });
        return;
      }

      // Finished but no DB data - return empty immediately (don't wait for API)
      // TheSportsAPI doesn't return data for finished matches anyway
      logger.warn(`[MatchController] Match finished but no DB data for ${match_id}, returning empty`);
      reply.send({
        success: true,
        data: {
          match_id,
          match_status: 8,
          stats: [],
          fullTime: { stats: [], results: [] },
          firstHalfStats: firstHalfStats || null,
          secondHalfStats: secondHalfStats || null,
          halfTime: null,
          incidents: [],
          score: null,
          sources: { basic: 0, detailed: 0, from: 'database (no data available)' },
        },
      });
      return;
    }

    // Get match status to detect HALF_TIME or 2nd half
    const matchStatus = await combinedStatsService.getMatchStatus(match_id);
    const isHalfTime = matchStatus === 3; // HALF_TIME
    const isSecondHalf = matchStatus === 4 || matchStatus === 5 || matchStatus === 7; // 2nd half, overtime, penalties

    // Get first_half_stats and second_half_stats from database (if exists)
    let firstHalfStats = await combinedStatsService.getFirstHalfStats(match_id);
    let secondHalfStats = await combinedStatsService.getSecondHalfStats(match_id);

    // ===== DB-FIRST ARCHITECTURE =====
    // For LIVE matches: Check ts_match_stats FIRST (instant response ~5ms)
    // This is populated by background sync in matchSync.job.ts
    const dbStats = await matchStatsRepository.getStats(match_id);
    if (dbStats && (dbStats.home_corner !== 0 || dbStats.away_corner !== 0 ||
      dbStats.home_shots !== 0 || dbStats.away_shots !== 0 ||
      dbStats.home_yellow_cards !== 0 || dbStats.away_yellow_cards !== 0)) {
      logger.debug(`[MatchController] ⚡ DB-FIRST: Returning stats from ts_match_stats for ${match_id}`);

      // Convert DB stats to API response format
      const statsArray = [
        { type: 2, home: dbStats.home_corner, away: dbStats.away_corner, name: 'Corner Kicks', nameTr: 'Korner' },
        { type: 3, home: dbStats.home_yellow_cards, away: dbStats.away_yellow_cards, name: 'Yellow Cards', nameTr: 'Sarı Kart' },
        { type: 4, home: dbStats.home_red_cards, away: dbStats.away_red_cards, name: 'Red Cards', nameTr: 'Kırmızı Kart' },
        { type: 21, home: dbStats.home_shots_on_target, away: dbStats.away_shots_on_target, name: 'Shots on Target', nameTr: 'İsabetli Şut' },
        { type: 22, home: (dbStats.home_shots || 0) - (dbStats.home_shots_on_target || 0), away: (dbStats.away_shots || 0) - (dbStats.away_shots_on_target || 0), name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
        { type: 23, home: dbStats.home_attacks, away: dbStats.away_attacks, name: 'Attacks', nameTr: 'Atak' },
        { type: 24, home: dbStats.home_dangerous_attacks, away: dbStats.away_dangerous_attacks, name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
        { type: 25, home: dbStats.home_possession, away: dbStats.away_possession, name: 'Ball Possession (%)', nameTr: 'Top Hakimiyeti' },
      ].filter(s => s.home !== undefined && s.away !== undefined);

      reply.send({
        success: true,
        data: {
          match_id,
          match_status: matchStatus,
          stats: statsArray,
          fullTime: { stats: statsArray, results: statsArray },
          firstHalfStats: firstHalfStats || null,
          secondHalfStats: secondHalfStats || null,
          halfTime: null,
          incidents: [],
          score: null,
          sources: { basic: statsArray.length, detailed: 0, from: 'database (db-first)' },
        },
      });
      return;
    }

    // For LIVE matches: Check CACHE second (if DB empty)
    // This prevents blocking the thread for 5-10s if the external API is slow
    const cachedLiveDetail = await liveMatchCache.get(match_id);
    if (cachedLiveDetail) {
      logger.debug(`[MatchController] Returning cached live detail for ${match_id}`);
      reply.send({
        success: true,
        data: cachedLiveDetail,
      });
      return;
    }

    logger.info(`[MatchController] Live cache miss for ${match_id}, fetching from API (status: ${matchStatus})`);

    let result: any = null;
    try {
      // Direct HTTP call - no overhead
      const apiUrl = `https://api.thesports.com/v1/football/match/detail_live?user=${process.env.THESPORTS_API_USER}&secret=${process.env.THESPORTS_API_SECRET}&id=${match_id}`;

      // Add timeout to prevent hanging forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const liveData = await response.json() as { results?: any[] };
      const matchData = liveData?.results?.find((r: any) => r.id === match_id) || liveData?.results?.[0];

      if (matchData) {
        // Map basic stats with names
        const STAT_NAMES: Record<number, { name: string; nameTr: string }> = {
          2: { name: 'Corner Kicks', nameTr: 'Korner' },
          3: { name: 'Yellow Cards', nameTr: 'Sarı Kart' },
          4: { name: 'Red Cards', nameTr: 'Kırmızı Kart' },
          8: { name: 'Penalties', nameTr: 'Penaltı' },
          21: { name: 'Shots on Target', nameTr: 'İsabetli Şut' },
          22: { name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
          23: { name: 'Attacks', nameTr: 'Atak' },
          24: { name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
          25: { name: 'Ball Possession (%)', nameTr: 'Top Hakimiyeti' },
          37: { name: 'Blocked Shots', nameTr: 'Engellenen Şut' },
        };

        const allStats = (matchData.stats || []).map((s: any) => ({
          type: s.type,
          home: s.home,
          away: s.away,
          name: STAT_NAMES[s.type]?.name || 'Unknown',
          nameTr: STAT_NAMES[s.type]?.nameTr || '',
        }));

        // Merge with incidents if present
        const incidents = matchData.incidents || [];
        const score = matchData.score || null;

        result = {
          match_id,
          match_status: matchStatus,
          stats: allStats,
          fullTime: {
            stats: allStats,
            results: allStats,
          },
          firstHalfStats: firstHalfStats || null,
          secondHalfStats: secondHalfStats || null,
          halfTime: null, // detail_live doesn't give half stats usually
          incidents: incidents,
          score: score,
          sources: {
            basic: allStats.length,
            detailed: 0,
            from: 'api (live)',
            hasFirstHalfSnapshot: !!firstHalfStats,
            hasSecondHalfSnapshot: !!secondHalfStats,
          },
        };

        // Cache the result for 15 seconds
        // This is critical for performance - prevents slamming the API and blocking the UI
        // TEMPORARILY DISABLED: LiveMatchCacheService doesn't have get/set methods for individual matches
        // await liveMatchCache.set(match_id, result, 15);
      }
    } catch (err: any) {
      logger.error(`[MatchController] Failed to fetch live stats for ${match_id}: ${err.message}`);
      // Return DB fallback if possible, or empty structure
    }

    if (result) {
      reply.send({
        success: true,
        data: result,
      });
      return;
    }

    // Fallback: If API failed, create empty result structure
    logger.warn(`[MatchController] No live data available for ${match_id}, using empty fallback`);
    result = {
      matchId: match_id,
      match_status: matchStatus,
      allStats: [],
      basicStats: [],
      detailedStats: [],
      incidents: [],
      score: null,
      halfTimeStats: null,
    };

    // CRITICAL: Save first half stats when match reaches HALF_TIME
    if (isHalfTime && result && result.allStats.length > 0 && !firstHalfStats) {
      logger.info(`[MatchController] ⚽ HALF_TIME detected! Saving first half stats for ${match_id}`);
      await combinedStatsService.saveFirstHalfStats(match_id, result.allStats);
      firstHalfStats = result.allStats;
    }

    // Save to database (CRITICAL for persistence after match ends)
    if (result && result.allStats.length > 0) {
      combinedStatsService.saveCombinedStatsToDatabase(match_id, result).catch((err) => {
        logger.error(`[MatchController] Failed to save stats to DB for ${match_id}:`, err);
      });
    }

    // Build response with first_half_stats and second_half_stats for period selection on frontend
    reply.send({
      success: true,
      data: {
        match_id: result.matchId,
        match_status: matchStatus,
        stats: result.allStats,
        fullTime: {
          stats: result.allStats,
          results: result.allStats,
        },
        // Half stats for frontend period selector (1. YARI / 2. YARI / TÜMÜ)
        firstHalfStats: firstHalfStats || null,
        secondHalfStats: secondHalfStats || null,
        halfTime: result.halfTimeStats || null,
        incidents: result.incidents,
        score: result.score,
        sources: {
          basic: result.basicStats.length,
          detailed: result.detailedStats.length,
          from: 'api',
          hasFirstHalfSnapshot: !!firstHalfStats,
          hasSecondHalfSnapshot: !!secondHalfStats,
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
    const preSyncService = new DailyPreSyncService();

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
    logger.info(`[getMatchH2H] ⚡ ENDPOINT CALLED for match ${match_id}`);

    // Try database first
    const { DailyPreSyncService } = await import('../services/thesports/sync/dailyPreSync.service');
    const preSyncService = new DailyPreSyncService();

    let h2hData = await preSyncService.getH2HFromDb(match_id);
    logger.info(`[getMatchH2H] Database query result for ${match_id}: ${h2hData ? 'FOUND' : 'NOT FOUND'}`);

    // If not in DB, try API and save (ONLY for NOT_STARTED matches)
    // CRITICAL: /match/analysis endpoint only works for matches that haven't started yet
    // According to API docs: "Matches within 30 days before today" (future matches)
    if (!h2hData) {
      // Check match status first
      const { pool } = await import('../database/connection');
      const client = await pool.connect();
      let matchStatus: number | null = null;
      try {
        const statusResult = await client.query(
          'SELECT status_id FROM ts_matches WHERE external_id = $1',
          [match_id]
        );
        if (statusResult.rows.length > 0) {
          matchStatus = statusResult.rows[0].status_id;
        }
      } finally {
        client.release();
      }

      // Only sync from API if match is NOT_STARTED (status = 1)
      // For started/finished matches, API returns empty results
      if (matchStatus === 1) {
        logger.info(`[getMatchH2H] H2H not in DB for ${match_id} (status=NOT_STARTED), fetching from API`);
        try {
          const syncResult = await preSyncService.syncH2HToDb(match_id);
          logger.info(`[getMatchH2H] syncH2HToDb result for ${match_id}: ${syncResult}`);
          h2hData = await preSyncService.getH2HFromDb(match_id);
          logger.info(`[getMatchH2H] After sync, h2hData from DB: ${h2hData ? 'found' : 'not found'}`);
        } catch (syncError: any) {
          logger.error(`[getMatchH2H] Failed to sync H2H for ${match_id}: ${syncError.message}`, syncError);
          // Continue - h2hData will be null and we'll return "No H2H data available"
        }
      } else {
        logger.info(`[getMatchH2H] Match ${match_id} has status ${matchStatus} (not NOT_STARTED). API /match/analysis only works for NOT_STARTED matches. Skipping API call.`);
      }
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

/**
 * GET /api/matches/unified
 *
 * Phase 6: Unified endpoint for frontend - single API call for all match data
 *
 * Query params:
 * - date: YYYY-MM-DD or YYYYMMDD (default: today)
 * - include_live: boolean (default: true) - include cross-day live matches
 * - include_ai: boolean (default: true) - include AI predictions (PHASE 1)
 * - status: comma-separated status IDs (optional) - filter by status
 *
 * Features:
 * - Merges diary matches with live matches
 * - Handles cross-day matches (yesterday's match still live)
 * - PHASE 1: Optional AI predictions enrichment via LEFT JOIN
 * - Uses smart cache with event-driven invalidation
 * - Single API call replaces frontend's multiple fetches
 */
export const getUnifiedMatches = async (
  request: FastifyRequest<{
    Querystring: {
      date?: string;
      include_live?: string;
      include_ai?: string;
      status?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { date, include_live, include_ai, status } = request.query;

    // Parse date (default: today in TSİ timezone)
    const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowTSI = new Date(Date.now() + TSI_OFFSET_MS);
    const todayStr = nowTSI.toISOString().split('T')[0].replace(/-/g, '');

    let dateStr = date?.replace(/-/g, '') || todayStr;
    if (!/^\d{8}$/.test(dateStr)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid date format. Expected YYYY-MM-DD or YYYYMMDD',
      });
    }

    // Parse include_live (default: true)
    const includeLive = include_live !== 'false';

    // PHASE 1: Parse include_ai (default: true)
    const includeAI = include_ai !== 'false';

    // Parse status filter
    let statusFilter: number[] | undefined;
    if (status) {
      statusFilter = status.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }

    // PHASE 1: Cache doesn't support AI yet - skip cache if includeAI is true
    const cached = liveMatchCache.getUnified(dateStr, includeLive);
    if (cached && !statusFilter && !includeAI) { // Don't use cache if status filter or AI is requested
      logger.debug(`[MatchController] Unified cache HIT for ${dateStr}`);

      // Add browser cache headers (30s cache with 60s stale-while-revalidate)
      reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      reply.header('X-Cache', 'HIT');

      return reply.send({
        success: true,
        data: {
          results: cached.results,
          date: dateStr,
          includeLive,
          source: 'cache',
          cacheStats: liveMatchCache.getStats(),
        },
      });
    }

    logger.info(`[MatchController] Unified fetch for date=${dateStr}, includeLive=${includeLive}, includeAI=${includeAI}`);

    // Normalize match helper
    const normalizeMatch = (row: any) => {
      const statusId = row.status_id ?? row.status ?? 1;
      const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
      const minuteText = generateMinuteText(minute, statusId);

      return {
        id: row.id,
        competition_id: row.competition_id,
        season_id: row.season_id,
        match_time: row.match_time,
        status_id: statusId,
        status: statusId,
        minute: minute,
        minute_text: minuteText,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        home_score: row.home_score ?? 0,
        away_score: row.away_score ?? 0,
        home_score_overtime: row.home_score_overtime ?? 0,
        away_score_overtime: row.away_score_overtime ?? 0,
        home_score_penalties: row.home_score_penalties ?? 0,
        away_score_penalties: row.away_score_penalties ?? 0,
        home_red_cards: row.home_red_cards ?? 0,
        away_red_cards: row.away_red_cards ?? 0,
        home_yellow_cards: row.home_yellow_cards ?? 0,
        away_yellow_cards: row.away_yellow_cards ?? 0,
        home_corners: row.home_corners ?? 0,
        away_corners: row.away_corners ?? 0,
        live_kickoff_time: row.live_kickoff_time ?? row.match_time ?? null,
        home_team: row.home_team || null,
        away_team: row.away_team || null,
        competition: row.competition || null,
        home_team_name: row.home_team_name || row.home_team?.name || null,
        away_team_name: row.away_team_name || row.away_team?.name || null,
      };
    };

    // PHASE 1: Step 1: Fetch diary matches for selected date (with AI if requested)
    const diaryResult = await matchDatabaseService.getMatchesByDate(dateStr, statusFilter, includeAI);
    const diaryMatches = (diaryResult.results || []).map(normalizeMatch);
    const diaryMatchIds = new Set(diaryMatches.map((m: any) => m.id));

    logger.debug(`[MatchController] Diary: ${diaryMatches.length} matches for ${dateStr}`);

    // PHASE 1: Step 2: Fetch live matches (if include_live is true, with AI if requested)
    let crossDayLiveMatches: any[] = [];
    if (includeLive) {
      const liveResult = await matchDatabaseService.getLiveMatches(includeAI);
      const allLiveMatches = (liveResult.results || []).map(normalizeMatch);

      // Only include live matches NOT in diary (cross-day matches)
      crossDayLiveMatches = allLiveMatches.filter((m: any) => !diaryMatchIds.has(m.id));

      logger.debug(`[MatchController] Cross-day live: ${crossDayLiveMatches.length} matches`);
    }

    // Step 3: Merge diary + cross-day live
    // Diary matches come first (sorted by match_time)
    // Cross-day live matches appended at the end
    const mergedMatches = [...diaryMatches, ...crossDayLiveMatches];

    // Apply status filter if provided (for cross-day matches too)
    let finalMatches = mergedMatches;
    if (statusFilter && statusFilter.length > 0) {
      finalMatches = mergedMatches.filter((m: any) => statusFilter!.includes(m.status_id));
    }

    // PHASE 1: Calculate AI predictions count
    const aiPredictionsCount = includeAI
      ? finalMatches.filter((m: any) => m.aiPrediction !== undefined).length
      : undefined;

    // Build response
    const response = {
      results: finalMatches,
    };

    // Cache the result (only if no status filter and no AI requested)
    if (!statusFilter && !includeAI) {
      liveMatchCache.setUnified(dateStr, includeLive, response);
    }

    // Add browser cache headers (30s cache with 60s stale-while-revalidate)
    reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    reply.header('X-Cache', 'MISS');

    reply.send({
      success: true,
      data: {
        results: finalMatches,
        date: dateStr,
        includeLive,
        counts: {
          total: finalMatches.length,
          diary: diaryMatches.length,
          crossDayLive: crossDayLiveMatches.length,
          live: finalMatches.filter((m: any) => [2, 3, 4, 5, 7].includes(m.status_id)).length,
          finished: finalMatches.filter((m: any) => m.status_id === 8).length,
          notStarted: finalMatches.filter((m: any) => m.status_id === 1).length,
          // PHASE 1: Add AI predictions count to response
          ...(aiPredictionsCount !== undefined ? { aiPredictions: aiPredictionsCount } : {}),
        },
        source: 'database',
        cacheStats: liveMatchCache.getStats(),
      },
    });
  } catch (error: any) {
    logger.error('[MatchController] Error in getUnifiedMatches:', error);
    reply.status(500).send({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get match incidents (optimized for Events tab)
 * GET /api/matches/:match_id/incidents
 *
 * Returns incidents (goals, cards, substitutions) for a specific match.
 * Uses database-first strategy with API fallback.
 *
 * Performance: 10,000ms → 300ms (97% faster than old getMatchDetailLive)
 */
export const getMatchIncidents = async (
  request: FastifyRequest<{ Params: { match_id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  try {
    const { match_id } = request.params;

    if (!match_id) {
      reply.status(400).send({
        success: false,
        error: 'match_id parameter is required'
      });
      return;
    }

    logger.info(`[getMatchIncidents] Fetching incidents for match: ${match_id}`);

    const result = await matchIncidentsService.getMatchIncidents(match_id);

    reply.send({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('[getMatchIncidents] Error:', error);
    reply.status(500).send({
      success: false,
      error: 'Failed to fetch match incidents'
    });
  }
};

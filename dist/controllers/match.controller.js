"use strict";
/**
 * Match Controller
 *
 * Handles HTTP requests/responses for match-related endpoints
 * NO business logic here - only request/response handling
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchFull = exports.getMatchIncidents = exports.getUnifiedMatches = exports.getMatchH2H = exports.triggerPreSync = exports.getMatchLiveStats = exports.getSeasonStandings = exports.getMatchHalfStats = exports.getMatchTrend = exports.getMatchAnalysis = exports.getLiveMatches = exports.getMatchPlayerStats = exports.getShouldBeLiveMatches = exports.getMatchTeamStats = exports.getMatchLineup = exports.getMatchSeasonRecent = exports.getMatchDetailLive = exports.getMatchById = exports.getMatchDiary = exports.getMatchRecentList = void 0;
const matchRecent_service_1 = require("../services/thesports/match/matchRecent.service");
const matchDiary_service_1 = require("../services/thesports/match/matchDiary.service");
const matchDatabase_service_1 = require("../services/thesports/match/matchDatabase.service");
const matchDetailLive_service_1 = require("../services/thesports/match/matchDetailLive.service");
const matchSeasonRecent_service_1 = require("../services/thesports/match/matchSeasonRecent.service");
const matchLineup_service_1 = require("../services/thesports/match/matchLineup.service");
const matchTeamStats_service_1 = require("../services/thesports/match/matchTeamStats.service");
const matchPlayerStats_service_1 = require("../services/thesports/match/matchPlayerStats.service");
const matchAnalysis_service_1 = require("../services/thesports/match/matchAnalysis.service");
const matchTrend_service_1 = require("../services/thesports/match/matchTrend.service");
const matchHalfStats_service_1 = require("../services/thesports/match/matchHalfStats.service");
const matchIncidents_service_1 = require("../services/thesports/match/matchIncidents.service");
const standings_service_1 = require("../services/thesports/season/standings.service");
const matchSync_service_1 = require("../services/thesports/match/matchSync.service");
const teamData_service_1 = require("../services/thesports/team/teamData.service");
const competition_service_1 = require("../services/thesports/competition/competition.service");
const combinedStats_service_1 = require("../services/thesports/match/combinedStats.service");
const logger_1 = require("../utils/logger");
const matchMinuteText_1 = require("../utils/matchMinuteText");
const liveMatchCache_service_1 = require("../services/thesports/match/liveMatchCache.service");
const matchStats_repository_1 = require("../repositories/matchStats.repository");
const matchCache_1 = require("../utils/matchCache");
const connection_1 = require("../database/connection");
const memoryCache_1 = require("../utils/cache/memoryCache");
// Initialize services with SINGLETON API client
// Services now use theSportsAPI singleton internally
const matchRecentService = new matchRecent_service_1.MatchRecentService();
const matchDiaryService = new matchDiary_service_1.MatchDiaryService();
const matchDatabaseService = new matchDatabase_service_1.MatchDatabaseService();
const matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
const matchSeasonRecentService = new matchSeasonRecent_service_1.MatchSeasonRecentService();
const matchLineupService = new matchLineup_service_1.MatchLineupService();
const matchTeamStatsService = new matchTeamStats_service_1.MatchTeamStatsService();
const matchPlayerStatsService = new matchPlayerStats_service_1.MatchPlayerStatsService();
const matchAnalysisService = new matchAnalysis_service_1.MatchAnalysisService();
const matchTrendService = new matchTrend_service_1.MatchTrendService();
const matchHalfStatsService = new matchHalfStats_service_1.MatchHalfStatsService();
const seasonStandingsService = new standings_service_1.SeasonStandingsService();
const teamDataService = new teamData_service_1.TeamDataService();
const competitionService = new competition_service_1.CompetitionService();
const matchSyncService = new matchSync_service_1.MatchSyncService(teamDataService, competitionService);
const combinedStatsService = new combinedStats_service_1.CombinedStatsService();
// --- Date helpers (TSİ bulletin) ---
const TSI_OFFSET_SECONDS = 3 * 3600;
/**
 * Returns today's date in TSİ (UTC+3) as YYYY-MM-DD and YYYYMMDD.
 * This prevents "wrong day" when the server runs in UTC.
 */
const getTodayTsi = () => {
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
const normalizeDiaryDate = (input) => {
    if (!input)
        return getTodayTsi();
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
const getMatchRecentList = async (request, reply) => {
    try {
        const { query } = request;
        const params = {
            page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
            limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
            competition_id: query.competition_id,
            season_id: query.season_id,
            date: query.date,
        };
        const result = await matchRecentService.getMatchRecentList(params);
        // Phase 4-4: Normalize all matches to ensure minute_text is always present (never null)
        const normalizeMatch = (match) => {
            const statusId = match.status_id ?? match.status ?? match.match_status ?? 1;
            const minute = match.minute !== null && match.minute !== undefined ? Number(match.minute) : null;
            const minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
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
    }
    catch (error) {
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchRecentList = getMatchRecentList;
/**
 * Get match diary
 * GET /api/matches/diary
 * CRITICAL: DB-only mode - queries database ONLY, no API fallback
 * API calls should only happen in sync workers (DailyMatchSyncWorker, etc.)
 */
const getMatchDiary = async (request, reply) => {
    try {
        const { query } = request;
        const normalizedDate = normalizeDiaryDate(query.date);
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
        let statusFilter;
        if (query.status) {
            try {
                statusFilter = query.status.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                if (statusFilter.length === 0) {
                    statusFilter = undefined;
                }
            }
            catch (error) {
                logger_1.logger.warn(`[MatchController] Invalid status filter: ${query.status}`);
            }
        }
        // CACHE: Check cache first
        const cachedData = (0, matchCache_1.getDiaryCache)(dbDate, statusFilter);
        if (cachedData) {
            // Cache hit - add Cache-Control headers for browser caching
            const ttl = (0, matchCache_1.getSmartTTL)(dbDate);
            reply.header('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
            reply.header('X-Cache', 'HIT');
            reply.send({
                success: true,
                data: cachedData,
            });
            return;
        }
        const normalizeDbMatch = (row) => {
            const externalId = row.external_id ?? row.match_id ?? row.id;
            const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;
            const homeScoreRegular = row.home_score_regular ?? row.home_score ?? 0;
            const awayScoreRegular = row.away_score_regular ?? row.away_score ?? 0;
            // Phase 3C: Read minute from DB and generate minute_text
            const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
            const minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
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
        logger_1.logger.info(`📊 [MatchDiary] Returning ${normalized.length} matches from database for ${dbDate} (DB-only mode, no API fallback)`);
        // Prepare response data
        const responseData = {
            ...dbResult,
            results: normalized,
        };
        // CACHE: Save to cache for future requests
        (0, matchCache_1.setDiaryCache)(dbDate, statusFilter, responseData);
        // Add Cache-Control headers for browser caching
        const ttl = (0, matchCache_1.getSmartTTL)(dbDate);
        reply.header('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
        reply.header('X-Cache', 'MISS');
        reply.send({
            success: true,
            data: responseData,
        });
    }
    catch (error) {
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchDiary = getMatchDiary;
/**
 * Get single match by ID
 * GET /api/matches/:match_id
 * Fetches match from database by external_id
 *
 * CRITICAL: No cache - always fetches fresh from database
 * Match status can change rapidly, cache would cause stale data
 */
const getMatchById = async (request, reply) => {
    try {
        const { match_id } = request.params;
        // CRITICAL: Always fetch fresh from database (no cache)
        // Match status changes frequently, cache would cause inconsistencies
        const { pool } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
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
            const { generateMinuteText } = await Promise.resolve().then(() => __importStar(require('../utils/matchMinuteText')));
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
                    logger_1.logger.warn(`[getMatchById] Future match ${match_id} had END status, corrected to NOT_STARTED`);
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
                    const incidentsQuery = await client.query('SELECT incidents FROM ts_matches WHERE external_id = $1', [match_id]);
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
                                    logger_1.logger.info(`[getMatchById] Extracted score from incidents for ${match_id}: ${finalHomeScore}-${finalAwayScore}`);
                                    break; // Use the last (most recent) incident with score
                                }
                            }
                        }
                    }
                }
                catch (incidentsError) {
                    // If incidents extraction fails, use original score
                    logger_1.logger.debug(`[getMatchById] Failed to extract score from incidents for ${match_id}: ${incidentsError.message}`);
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
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchById:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchById = getMatchById;
/**
 * Get match detail live (incidents, stats, score)
 * GET /api/matches/:match_id/detail-live
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
const getMatchDetailLive = async (request, reply) => {
    try {
        const { match_id } = request.params;
        // Check if match is finished
        const isFinished = await combinedStatsService.isMatchFinished(match_id);
        // For FINISHED matches, return from database
        if (isFinished) {
            const dbResult = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
            if (dbResult && (dbResult.incidents.length > 0 || dbResult.allStats.length > 0)) {
                logger_1.logger.debug(`[MatchController] Match finished, returning detail-live from DB for ${match_id}`);
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
            logger_1.logger.warn(`[MatchController] Match finished but no DB data for detail-live ${match_id}, returning empty`);
            reply.send({
                success: true,
                data: {
                    results: [{ id: match_id, incidents: [], stats: [], score: null }],
                    source: 'database (no data available)'
                },
            });
            return;
        }
        // PERF FIX Phase 1: Reduced timeout from 5s to 2s (fail fast)
        const params = { match_id };
        let result = null;
        try {
            const apiPromise = matchDetailLiveService.getMatchDetailLive(params);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 2000));
            result = await Promise.race([apiPromise, timeoutPromise]);
        }
        catch (err) {
            logger_1.logger.warn(`[MatchController] detail-live API timeout for ${match_id}: ${err.message}`);
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
            const matchData = result.results.find((r) => r.id === match_id) || result.results[0];
            if (matchData?.incidents?.length > 0) {
                // Get existing stats and merge with incidents
                const existingStats = await combinedStatsService.getCombinedStatsFromDatabase(match_id);
                if (existingStats) {
                    existingStats.incidents = matchData.incidents;
                    existingStats.score = matchData.score || existingStats.score;
                    combinedStatsService.saveCombinedStatsToDatabase(match_id, existingStats).catch(err => {
                        logger_1.logger.error(`[MatchController] Failed to save incidents to DB for ${match_id}:`, err);
                    });
                }
                else {
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
                        logger_1.logger.error(`[MatchController] Failed to save incidents to DB for ${match_id}:`, err);
                    });
                }
            }
        }
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchDetailLive:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchDetailLive = getMatchDetailLive;
/**
 * Get match season recent
 * GET /api/matches/season/recent
 */
const getMatchSeasonRecent = async (request, reply) => {
    try {
        const { query } = request;
        const params = {
            season_id: String(query.season_id),
            page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
            limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
        };
        const result = await matchSeasonRecentService.getMatchSeasonRecent(params);
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchSeasonRecent = getMatchSeasonRecent;
/**
 * Get match lineup (reads from database first, then API fallback)
 * GET /api/matches/:match_id/lineup
 */
const getMatchLineup = async (request, reply) => {
    try {
        const { match_id } = request.params;
        // Try database first
        const { DailyPreSyncService } = await Promise.resolve().then(() => __importStar(require('../services/thesports/sync/dailyPreSync.service')));
        const preSyncService = new DailyPreSyncService();
        let lineupData = await preSyncService.getLineupFromDb(match_id);
        // If not in DB, try API and save
        if (!lineupData) {
            logger_1.logger.info(`Lineup not in DB for ${match_id}, fetching from API`);
            try {
                await preSyncService.syncLineupToDb(match_id);
                lineupData = await preSyncService.getLineupFromDb(match_id);
            }
            catch (syncError) {
                logger_1.logger.warn(`Failed to sync lineup for ${match_id}: ${syncError.message}`);
                // Continue to API fallback even if sync fails
            }
        }
        // If still no data in DB, try API directly (fallback)
        if (!lineupData) {
            logger_1.logger.info(`Lineup still not in DB for ${match_id}, trying API directly`);
            const params = { match_id };
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
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchLineup:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchLineup = getMatchLineup;
/**
 * Get match team stats
 * GET /api/matches/:match_id/team-stats
 */
const getMatchTeamStats = async (request, reply) => {
    try {
        const { match_id } = request.params;
        const params = { match_id };
        const result = await matchTeamStatsService.getMatchTeamStats(params);
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchTeamStats = getMatchTeamStats;
/**
 * Get should-be-live matches (ops/debug endpoint)
 * GET /api/matches/should-be-live?maxMinutesAgo=120
 *
 * Phase 5-S: Returns matches with status_id=1 but match_time has passed.
 * These are candidates for watchdog reconciliation.
 * NOT used by frontend live view - only for ops/debug visibility.
 */
const getShouldBeLiveMatches = async (request, reply) => {
    try {
        const maxMinutesAgo = request.query.maxMinutesAgo ? parseInt(request.query.maxMinutesAgo, 10) : 120;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 200;
        const result = await matchDatabaseService.getShouldBeLiveMatches(maxMinutesAgo, limit);
        // Normalize results (same as getLiveMatches)
        const normalizeDbMatch = (row) => {
            const externalId = row.external_id ?? row.match_id ?? row.id;
            const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;
            const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
            const minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
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
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getShouldBeLiveMatches:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getShouldBeLiveMatches = getShouldBeLiveMatches;
/**
 * Get match player stats
 * GET /api/matches/:match_id/player-stats
 */
const getMatchPlayerStats = async (request, reply) => {
    try {
        const { match_id } = request.params;
        const params = { match_id };
        const result = await matchPlayerStatsService.getMatchPlayerStats(params);
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchPlayerStats = getMatchPlayerStats;
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
const getLiveMatches = async (request, reply) => {
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
        const normalizeDbMatch = (row) => {
            const externalId = row.external_id ?? row.match_id ?? row.id;
            const statusId = row.status_id ?? row.status ?? row.match_status ?? 1;
            // PHASE 7: Database query fixed to read home_score_display directly
            // No fallback needed - database returns COALESCE(home_score_display, 0) as home_score
            const homeScoreDisplay = row.home_score ?? 0;
            const awayScoreDisplay = row.away_score ?? 0;
            // Phase 3C: Read minute from DB and generate minute_text
            const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
            const minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
            return {
                ...row,
                external_id: externalId,
                match_id: externalId,
                status: statusId,
                match_status: statusId,
                status_id: statusId,
                home_score_regular: homeScoreDisplay, // FIXED: Use display score
                away_score_regular: awayScoreDisplay, // FIXED: Use display score
                home_score: homeScoreDisplay, // FIXED: Use display score
                away_score: awayScoreDisplay, // FIXED: Use display score
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
    }
    catch (error) {
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getLiveMatches = getLiveMatches;
/**
 * Get match analysis (H2H)
 * GET /api/matches/:match_id/analysis
 */
const getMatchAnalysis = async (request, reply) => {
    try {
        const { match_id } = request.params;
        const params = { match_id };
        const result = await matchAnalysisService.getMatchAnalysis(params);
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchAnalysis:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchAnalysis = getMatchAnalysis;
/**
 * Get match trend (minute-by-minute data)
 * GET /api/matches/:match_id/trend
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
const getMatchTrend = async (request, reply) => {
    try {
        const { match_id } = request.params;
        const params = { match_id };
        // Get match status from database
        const { pool } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
        const client = await pool.connect();
        let matchStatus;
        try {
            const result = await client.query('SELECT status_id FROM ts_matches WHERE external_id = $1', [match_id]);
            if (result.rows.length > 0) {
                matchStatus = result.rows[0].status_id;
            }
        }
        finally {
            client.release();
        }
        const isFinished = matchStatus === 8;
        // For FINISHED matches, return from database first
        if (isFinished) {
            const dbTrend = await getTrendFromDatabase(match_id);
            if (dbTrend && dbTrend.results && dbTrend.results.length > 0) {
                logger_1.logger.debug(`[MatchController] Match finished, returning trend from DB for ${match_id}`);
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
        // PERF FIX Phase 1: Added 2s timeout (was unlimited - could hang forever!)
        let result = null;
        try {
            const trendPromise = matchTrendService.getMatchTrend(params, matchStatus);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Trend API timeout')), 2000));
            result = await Promise.race([trendPromise, timeoutPromise]);
        }
        catch (err) {
            logger_1.logger.warn(`[MatchController] Trend API timeout for ${match_id}: ${err.message}`);
            // Return empty on timeout
            reply.send({
                success: true,
                data: { results: [] },
            });
            return;
        }
        // Save trend data to database for persistence
        if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
            saveTrendToDatabase(match_id, result).catch(err => {
                logger_1.logger.error(`[MatchController] Failed to save trend to DB for ${match_id}:`, err);
            });
        }
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchTrend:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchTrend = getMatchTrend;
// Helper function to get trend from database
// CRITICAL FIX: Read from trend_data column (not statistics->'trend')
// PostMatchProcessor writes to trend_data column
async function getTrendFromDatabase(matchId) {
    const { pool } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
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
    }
    catch (error) {
        logger_1.logger.error(`[MatchController] Error reading trend from database for ${matchId}:`, error);
        return null;
    }
    finally {
        client.release();
    }
}
// Helper function to save trend to database
async function saveTrendToDatabase(matchId, trendData) {
    const { pool } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
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
        logger_1.logger.info(`[MatchController] Saved trend data to database for match: ${matchId}`);
    }
    catch (error) {
        logger_1.logger.error(`[MatchController] Error saving trend to database for ${matchId}:`, error);
    }
    finally {
        client.release();
    }
}
/**
 * Get match half stats (first half / second half breakdown)
 * GET /api/matches/:match_id/half-stats
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
const getMatchHalfStats = async (request, reply) => {
    try {
        const { match_id } = request.params;
        // Check if match is finished
        const isFinished = await combinedStatsService.isMatchFinished(match_id);
        // For FINISHED matches, ALWAYS try database first
        if (isFinished) {
            const dbHalfStats = await combinedStatsService.getHalfTimeStatsFromDatabase(match_id);
            if (dbHalfStats) {
                logger_1.logger.debug(`[MatchController] Match finished, returning half-stats from DB for ${match_id}`);
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
            logger_1.logger.warn(`[MatchController] Match finished but no half-stats in DB for ${match_id}, trying API`);
        }
        // Fetch from API
        const params = { match_id };
        const result = await matchHalfStatsService.getMatchHalfStatsDetail(params);
        // Parse and save half-time stats to database
        if (result?.results && Array.isArray(result.results) && result.results.length > 0) {
            try {
                const halfTimeStats = parseHalfTimeStatsFromApiResponse(result.results);
                if (halfTimeStats) {
                    combinedStatsService.saveHalfTimeStatsToDatabase(match_id, halfTimeStats).catch(err => {
                        logger_1.logger.error(`[MatchController] Failed to save half-stats to DB for ${match_id}:`, err);
                    });
                }
            }
            catch (parseErr) {
                logger_1.logger.warn(`[MatchController] Failed to parse half-stats for ${match_id}:`, parseErr);
            }
        }
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchHalfStats:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchHalfStats = getMatchHalfStats;
// Helper function to convert stats array to object format for API response
function convertStatsArrayToObject(stats) {
    const result = {};
    if (!stats || !Array.isArray(stats))
        return result;
    for (const stat of stats) {
        if (stat.type !== undefined) {
            result[String(stat.type)] = [stat.home ?? 0, stat.away ?? 0];
        }
    }
    return result;
}
// Helper function to parse half-time stats from API response
function parseHalfTimeStatsFromApiResponse(results) {
    if (!results || !Array.isArray(results))
        return null;
    const firstHalf = [];
    const secondHalf = [];
    const fullTime = [];
    for (const item of results) {
        const sign = item.Sign;
        if (!sign)
            continue;
        const stats = [];
        for (const [key, value] of Object.entries(item)) {
            if (key === 'Sign')
                continue;
            const typeId = Number(key);
            if (isNaN(typeId))
                continue;
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
        }
        else if (sign === 'p2') {
            secondHalf.push(...stats);
        }
        else if (sign === 'ft') {
            fullTime.push(...stats);
        }
    }
    return { firstHalf, secondHalf, fullTime };
}
/**
 * Get season standings
 * GET /api/seasons/:season_id/standings
 */
const getSeasonStandings = async (request, reply) => {
    try {
        const { season_id } = request.params;
        const params = { season_id };
        const result = await seasonStandingsService.getSeasonStandings(params);
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getSeasonStandings:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getSeasonStandings = getSeasonStandings;
/**
 * Get match live stats (COMBINED from /match/detail_live AND /match/team_stats)
 * GET /api/matches/:match_id/live-stats
 * Returns combined stats from:
 * 1. Real-time Data (corner, cards, shots, attacks, possession)
 * 2. Match Team Statistics (passes, tackles, interceptions, crosses)
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
const getMatchLiveStats = async (request, reply) => {
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
                logger_1.logger.debug(`[MatchController] Match finished, returning stats from DB for ${match_id}`);
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
            logger_1.logger.warn(`[MatchController] Match finished but no DB data for ${match_id}, returning empty`);
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
        const dbStats = await matchStats_repository_1.matchStatsRepository.getStats(match_id);
        if (dbStats && (dbStats.home_corner !== 0 || dbStats.away_corner !== 0 ||
            dbStats.home_shots !== 0 || dbStats.away_shots !== 0 ||
            dbStats.home_yellow_cards !== 0 || dbStats.away_yellow_cards !== 0)) {
            logger_1.logger.debug(`[MatchController] ⚡ DB-FIRST: Returning stats from ts_match_stats for ${match_id}`);
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
        const cachedLiveDetail = await liveMatchCache_service_1.liveMatchCache.get(match_id);
        if (cachedLiveDetail) {
            logger_1.logger.debug(`[MatchController] Returning cached live detail for ${match_id}`);
            reply.send({
                success: true,
                data: cachedLiveDetail,
            });
            return;
        }
        logger_1.logger.info(`[MatchController] Live cache miss for ${match_id}, fetching from API (status: ${matchStatus})`);
        let result = null;
        try {
            // Direct HTTP call - no overhead
            const apiUrl = `https://api.thesports.com/v1/football/match/detail_live?user=${process.env.THESPORTS_API_USER}&secret=${process.env.THESPORTS_API_SECRET}&id=${match_id}`;
            // PERF FIX Phase 1: Reduced timeout from 3s to 2s (fail fast)
            // If external API is slow, return empty and let UI show "no data"
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const liveData = await response.json();
            const matchData = liveData?.results?.find((r) => r.id === match_id) || liveData?.results?.[0];
            if (matchData) {
                // Map basic stats with names
                const STAT_NAMES = {
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
                const allStats = (matchData.stats || []).map((s) => ({
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
        }
        catch (err) {
            logger_1.logger.error(`[MatchController] Failed to fetch live stats for ${match_id}: ${err.message}`);
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
        logger_1.logger.warn(`[MatchController] No live data available for ${match_id}, using empty fallback`);
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
            logger_1.logger.info(`[MatchController] ⚽ HALF_TIME detected! Saving first half stats for ${match_id}`);
            await combinedStatsService.saveFirstHalfStats(match_id, result.allStats);
            firstHalfStats = result.allStats;
        }
        // Save to database (CRITICAL for persistence after match ends)
        if (result && result.allStats.length > 0) {
            combinedStatsService.saveCombinedStatsToDatabase(match_id, result).catch((err) => {
                logger_1.logger.error(`[MatchController] Failed to save stats to DB for ${match_id}:`, err);
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
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchLiveStats:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchLiveStats = getMatchLiveStats;
/**
 * Trigger pre-sync for today's matches
 * POST /api/admin/pre-sync
 * Syncs H2H, lineups, standings, and compensation data
 */
const triggerPreSync = async (request, reply) => {
    try {
        const { DailyPreSyncService } = await Promise.resolve().then(() => __importStar(require('../services/thesports/sync/dailyPreSync.service')));
        const preSyncService = new DailyPreSyncService();
        // Get today's matches from database
        const today = new Date().toISOString().split('T')[0];
        const dbResult = await matchDatabaseService.getMatchesByDate(today);
        const matches = dbResult.results || [];
        const matchIds = matches.map((m) => m.external_id || m.id).filter(Boolean);
        const seasonIds = matches.map((m) => m.season_id).filter(Boolean);
        logger_1.logger.info(`Triggering pre-sync for ${matchIds.length} matches, ${seasonIds.length} seasons`);
        const result = await preSyncService.runPreSync(matchIds, seasonIds);
        reply.send({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in triggerPreSync:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.triggerPreSync = triggerPreSync;
/**
 * Get H2H data (reads from database first, then API fallback)
 * GET /api/matches/:match_id/h2h
 */
const getMatchH2H = async (request, reply) => {
    try {
        const { match_id } = request.params;
        logger_1.logger.info(`[getMatchH2H] ⚡ ENDPOINT CALLED for match ${match_id}`);
        // Try database first
        const { DailyPreSyncService } = await Promise.resolve().then(() => __importStar(require('../services/thesports/sync/dailyPreSync.service')));
        const preSyncService = new DailyPreSyncService();
        let h2hData = await preSyncService.getH2HFromDb(match_id);
        logger_1.logger.info(`[getMatchH2H] Database query result for ${match_id}: ${h2hData ? 'FOUND' : 'NOT FOUND'}`);
        // If not in DB, try API and save (ONLY for NOT_STARTED matches)
        // CRITICAL: /match/analysis endpoint only works for matches that haven't started yet
        // According to API docs: "Matches within 30 days before today" (future matches)
        if (!h2hData) {
            // Check match status first
            const { pool } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
            const client = await pool.connect();
            let matchStatus = null;
            try {
                const statusResult = await client.query('SELECT status_id FROM ts_matches WHERE external_id = $1', [match_id]);
                if (statusResult.rows.length > 0) {
                    matchStatus = statusResult.rows[0].status_id;
                }
            }
            finally {
                client.release();
            }
            // Only sync from API if match is NOT_STARTED (status = 1)
            // For started/finished matches, API returns empty results
            if (matchStatus === 1) {
                logger_1.logger.info(`[getMatchH2H] H2H not in DB for ${match_id} (status=NOT_STARTED), fetching from API`);
                try {
                    const syncResult = await preSyncService.syncH2HToDb(match_id);
                    logger_1.logger.info(`[getMatchH2H] syncH2HToDb result for ${match_id}: ${syncResult}`);
                    h2hData = await preSyncService.getH2HFromDb(match_id);
                    logger_1.logger.info(`[getMatchH2H] After sync, h2hData from DB: ${h2hData ? 'found' : 'not found'}`);
                }
                catch (syncError) {
                    logger_1.logger.error(`[getMatchH2H] Failed to sync H2H for ${match_id}: ${syncError.message}`, syncError);
                    // Continue - h2hData will be null and we'll return "No H2H data available"
                }
            }
            else {
                logger_1.logger.info(`[getMatchH2H] Match ${match_id} has status ${matchStatus} (not NOT_STARTED). API /match/analysis only works for NOT_STARTED matches. Skipping API call.`);
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
        }
        else {
            reply.send({
                success: true,
                data: null,
                message: 'No H2H data available for this match',
            });
        }
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getMatchH2H:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getMatchH2H = getMatchH2H;
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
const getUnifiedMatches = async (request, reply) => {
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
        let statusFilter;
        if (status) {
            statusFilter = status.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        }
        // PHASE 1: Cache doesn't support AI yet - skip cache if includeAI is true
        const cached = liveMatchCache_service_1.liveMatchCache.getUnified(dateStr, includeLive);
        if (cached && !statusFilter && !includeAI) { // Don't use cache if status filter or AI is requested
            logger_1.logger.debug(`[MatchController] Unified cache HIT for ${dateStr}`);
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
                    cacheStats: liveMatchCache_service_1.liveMatchCache.getStats(),
                },
            });
        }
        logger_1.logger.info(`[MatchController] Unified fetch for date=${dateStr}, includeLive=${includeLive}, includeAI=${includeAI}`);
        // Normalize match helper
        const normalizeMatch = (row) => {
            const statusId = row.status_id ?? row.status ?? 1;
            const minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
            const minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
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
        const diaryMatchIds = new Set(diaryMatches.map((m) => m.id));
        logger_1.logger.debug(`[MatchController] Diary: ${diaryMatches.length} matches for ${dateStr}`);
        // PHASE 1: Step 2: Fetch live matches (if include_live is true, with AI if requested)
        let crossDayLiveMatches = [];
        if (includeLive) {
            const liveResult = await matchDatabaseService.getLiveMatches(includeAI);
            const allLiveMatches = (liveResult.results || []).map(normalizeMatch);
            // Only include live matches NOT in diary (cross-day matches)
            crossDayLiveMatches = allLiveMatches.filter((m) => !diaryMatchIds.has(m.id));
            logger_1.logger.debug(`[MatchController] Cross-day live: ${crossDayLiveMatches.length} matches`);
        }
        // Step 3: Merge diary + cross-day live
        // Diary matches come first (sorted by match_time)
        // Cross-day live matches appended at the end
        const mergedMatches = [...diaryMatches, ...crossDayLiveMatches];
        // Apply status filter if provided (for cross-day matches too)
        let finalMatches = mergedMatches;
        if (statusFilter && statusFilter.length > 0) {
            finalMatches = mergedMatches.filter((m) => statusFilter.includes(m.status_id));
        }
        // PHASE 1: Calculate AI predictions count
        const aiPredictionsCount = includeAI
            ? finalMatches.filter((m) => m.aiPrediction !== undefined).length
            : undefined;
        // Build response
        const response = {
            results: finalMatches,
        };
        // Cache the result (only if no status filter and no AI requested)
        if (!statusFilter && !includeAI) {
            liveMatchCache_service_1.liveMatchCache.setUnified(dateStr, includeLive, response);
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
                    live: finalMatches.filter((m) => [2, 3, 4, 5, 7].includes(m.status_id)).length,
                    finished: finalMatches.filter((m) => m.status_id === 8).length,
                    notStarted: finalMatches.filter((m) => m.status_id === 1).length,
                    // PHASE 1: Add AI predictions count to response
                    ...(aiPredictionsCount !== undefined ? { aiPredictions: aiPredictionsCount } : {}),
                },
                source: 'database',
                cacheStats: liveMatchCache_service_1.liveMatchCache.getStats(),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('[MatchController] Error in getUnifiedMatches:', error);
        reply.status(500).send({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.getUnifiedMatches = getUnifiedMatches;
/**
 * Get match incidents (optimized for Events tab)
 * GET /api/matches/:match_id/incidents
 *
 * Returns incidents (goals, cards, substitutions) for a specific match.
 * Uses database-first strategy with API fallback.
 *
 * Performance: 10,000ms → 300ms (97% faster than old getMatchDetailLive)
 */
const getMatchIncidents = async (request, reply) => {
    try {
        const { match_id } = request.params;
        if (!match_id) {
            reply.status(400).send({
                success: false,
                error: 'match_id parameter is required'
            });
            return;
        }
        logger_1.logger.info(`[getMatchIncidents] Fetching incidents for match: ${match_id}`);
        const result = await matchIncidents_service_1.matchIncidentsService.getMatchIncidents(match_id);
        reply.send({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('[getMatchIncidents] Error:', error);
        reply.status(500).send({
            success: false,
            error: 'Failed to fetch match incidents'
        });
    }
};
exports.getMatchIncidents = getMatchIncidents;
/**
 * GET /api/matches/:match_id/full
 *
 * PERF FIX Phase 2: Unified endpoint - returns ALL match detail data in single call
 *
 * This reduces frontend from 6 API calls to 1 API call
 * Server-side parallel fetch with 2s global timeout
 *
 * Returns:
 * - match: Basic match info (teams, score, status)
 * - stats: Live statistics (possession, shots, etc.)
 * - incidents: Goals, cards, substitutions
 * - lineup: Team lineups and formations
 * - h2h: Head-to-head history
 * - trend: Minute-by-minute data
 * - standings: League table (if available)
 */
const getMatchFull = async (request, reply) => {
    const startTime = Date.now();
    const { match_id } = request.params;
    if (!match_id) {
        reply.status(400).send({
            success: false,
            error: 'match_id parameter is required'
        });
        return;
    }
    // ============================================================
    // PHASE 5: MEMORY CACHE CHECK (L2 Cache - <1ms)
    // ============================================================
    const cacheKey = memoryCache_1.cacheKeys.matchFull(match_id);
    const cached = memoryCache_1.memoryCache.get('matchFull', cacheKey);
    if (cached) {
        const duration = Date.now() - startTime;
        logger_1.logger.debug(`[getMatchFull] CACHE HIT for ${match_id} (${duration}ms)`);
        reply.send({
            success: true,
            data: cached,
            meta: {
                duration_ms: duration,
                match_found: !!cached.match,
                source: 'memory_cache',
                timestamp: new Date().toISOString(),
            }
        });
        return;
    }
    // ============================================================
    // CACHE MISS - Fetch from database
    // ============================================================
    logger_1.logger.info(`[getMatchFull] CACHE MISS for ${match_id}, fetching from DB`);
    try {
        // Global timeout wrapper - 3s max for entire operation
        const globalTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Global timeout')), 3000));
        const fetchAllData = async () => {
            // Fetch all data in parallel (server-side)
            const [matchResult, statsResult, incidentsResult, lineupResult, h2hResult, trendResult] = await Promise.all([
                // Match basic info (DB only - fast)
                getMatchFromDb(match_id).catch((err) => {
                    logger_1.logger.error(`[getMatchFull] Match fetch failed for ${match_id}:`, err.message);
                    return null;
                }),
                // Stats - use existing service with 1s individual timeout
                fetchStatsWithTimeout(match_id, 1000).catch(() => ({ stats: [] })),
                // Incidents - use existing service with 1s individual timeout
                matchIncidents_service_1.matchIncidentsService.getMatchIncidents(match_id)
                    .then(r => r.incidents || [])
                    .catch(() => []),
                // Lineup - use existing service with 1s individual timeout
                getLineupFromDb(match_id).catch(() => null),
                // H2H - use existing service (DB only - fast)
                getH2HFromDb(match_id).catch(() => null),
                // Trend - use existing service with 1s individual timeout
                getTrendFromDb(match_id).catch(() => []),
            ]);
            // Build response object
            return {
                match: matchResult,
                stats: statsResult?.stats || [],
                incidents: incidentsResult || [],
                lineup: lineupResult,
                h2h: h2hResult,
                trend: trendResult || [],
            };
        };
        // Race against global timeout
        const result = await Promise.race([fetchAllData(), globalTimeout]);
        // Fetch standings separately (non-blocking)
        let standings = [];
        if (result.match?.season_id) {
            try {
                const standingsResult = await seasonStandingsService.getStandingsFromDb(result.match.season_id);
                standings = standingsResult || [];
            }
            catch {
                // Ignore standings errors
            }
        }
        // Build final response data
        const responseData = {
            ...result,
            standings,
        };
        // ============================================================
        // PHASE 5: CACHE THE RESULT (status-aware TTL)
        // ============================================================
        if (result.match) {
            const statusId = result.match.status_id;
            memoryCache_1.memoryCache.set('matchFull', cacheKey, responseData, statusId);
            logger_1.logger.debug(`[getMatchFull] Cached ${match_id} with status ${statusId}`);
        }
        const duration = Date.now() - startTime;
        // Log warning if match not found
        if (!result.match) {
            logger_1.logger.warn(`[getMatchFull] Match not found in DB for ${match_id} (${duration}ms)`);
        }
        else {
            logger_1.logger.info(`[getMatchFull] Completed in ${duration}ms for ${match_id} (source: database)`);
        }
        reply.send({
            success: true,
            data: responseData,
            meta: {
                duration_ms: duration,
                match_found: !!result.match,
                source: 'database',
                timestamp: new Date().toISOString(),
            }
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error(`[getMatchFull] Error after ${duration}ms:`, error.message);
        // On timeout, return partial data if available
        if (error.message === 'Global timeout') {
            reply.send({
                success: true,
                data: {
                    match: null,
                    stats: [],
                    incidents: [],
                    lineup: null,
                    h2h: null,
                    trend: [],
                    standings: [],
                },
                meta: {
                    duration_ms: duration,
                    timeout: true,
                    source: 'timeout',
                    timestamp: new Date().toISOString(),
                }
            });
            return;
        }
        reply.status(500).send({
            success: false,
            error: 'Failed to fetch match data'
        });
    }
};
exports.getMatchFull = getMatchFull;
// Helper: Fetch stats with individual timeout
// BUGFIX: Now uses combinedStatsService to get BOTH basic AND detailed stats
// This ensures detailed stats (passes, tackles, interceptions) are included
async function fetchStatsWithTimeout(matchId, timeoutMs) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Stats timeout')), timeoutMs));
    const statsPromise = (async () => {
        // First, try to get combined stats from database (fast)
        const dbCombinedStats = await combinedStatsService.getCombinedStatsFromDatabase(matchId);
        if (dbCombinedStats && dbCombinedStats.allStats.length > 0) {
            logger_1.logger.debug(`[fetchStatsWithTimeout] DB hit for ${matchId}: ${dbCombinedStats.allStats.length} stats`);
            return { stats: dbCombinedStats.allStats };
        }
        // Fallback: Try basic stats from matchStatsRepository
        const dbStats = await matchStats_repository_1.matchStatsRepository.getMatchStats(matchId);
        if (dbStats && (dbStats.home_corner !== 0 || dbStats.away_corner !== 0 ||
            dbStats.home_shots !== 0 || dbStats.away_shots !== 0)) {
            return {
                stats: [
                    { type: 25, home: dbStats.home_possession || 0, away: dbStats.away_possession || 0, name: 'Ball Possession', nameTr: 'Top Hakimiyeti' },
                    { type: 21, home: dbStats.home_shots_on_target || 0, away: dbStats.away_shots_on_target || 0, name: 'Shots on Target', nameTr: 'İsabetli Şut' },
                    { type: 22, home: dbStats.home_shots_off_target || 0, away: dbStats.away_shots_off_target || 0, name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
                    { type: 23, home: dbStats.home_attacks || 0, away: dbStats.away_attacks || 0, name: 'Attacks', nameTr: 'Atak' },
                    { type: 24, home: dbStats.home_dangerous_attacks || 0, away: dbStats.away_dangerous_attacks || 0, name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
                    { type: 2, home: dbStats.home_corner || 0, away: dbStats.away_corner || 0, name: 'Corner Kicks', nameTr: 'Korner' },
                    { type: 3, home: dbStats.home_yellow_cards || 0, away: dbStats.away_yellow_cards || 0, name: 'Yellow Cards', nameTr: 'Sarı Kart' },
                    { type: 4, home: dbStats.home_red_cards || 0, away: dbStats.away_red_cards || 0, name: 'Red Cards', nameTr: 'Kırmızı Kart' },
                ].filter(s => s.home !== undefined && s.away !== undefined)
            };
        }
        return { stats: [] };
    })();
    return Promise.race([statsPromise, timeout]);
}
// Helper: Get match from database
async function getMatchFromDb(matchId) {
    try {
        const result = await connection_1.pool.query(`
      SELECT
        m.external_id as id,
        m.home_team_id,
        m.away_team_id,
        m.competition_id,
        m.season_id,
        m.match_time,
        m.status_id,
        m.minute,
        m.incidents,
        -- CRITICAL FIX: Use COALESCE to get score from multiple sources (same as getMatchById)
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
        COALESCE(m.home_score_overtime, 0) as home_score_overtime,
        COALESCE(m.away_score_overtime, 0) as away_score_overtime,
        COALESCE(m.home_score_penalties, 0) as home_score_penalties,
        COALESCE(m.away_score_penalties, 0) as away_score_penalties,
        COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,
        COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,
        COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,
        COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,
        COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,
        COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,
        -- CRITICAL FIX: Column is logo_url not logo
        ht.name as home_team_name,
        ht.logo_url as home_team_logo,
        at.name as away_team_name,
        at.logo_url as away_team_logo,
        c.name as competition_name,
        c.logo_url as competition_logo,
        c.country_id
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON ht.external_id = m.home_team_id
      LEFT JOIN ts_teams at ON at.external_id = m.away_team_id
      LEFT JOIN ts_competitions c ON c.external_id = m.competition_id
      WHERE m.external_id = $1
    `, [matchId]);
        if (result.rows.length === 0) {
            logger_1.logger.warn(`[getMatchFromDb] Match not found in DB: ${matchId}`);
            return null;
        }
        const row = result.rows[0];
        // Generate minute_text from status and minute
        const minuteText = (0, matchMinuteText_1.generateMinuteText)(row.minute, row.status_id);
        return {
            id: row.id,
            home_team_id: row.home_team_id,
            away_team_id: row.away_team_id,
            competition_id: row.competition_id,
            season_id: row.season_id,
            match_time: row.match_time,
            status_id: row.status_id,
            home_score: row.home_score,
            away_score: row.away_score,
            minute: row.minute,
            minute_text: minuteText,
            // Score details
            home_score_overtime: row.home_score_overtime,
            away_score_overtime: row.away_score_overtime,
            home_score_penalties: row.home_score_penalties,
            away_score_penalties: row.away_score_penalties,
            // Cards and corners
            home_red_cards: row.home_red_cards,
            away_red_cards: row.away_red_cards,
            home_yellow_cards: row.home_yellow_cards,
            away_yellow_cards: row.away_yellow_cards,
            home_corners: row.home_corners,
            away_corners: row.away_corners,
            // Team and competition info with correct field names for frontend
            home_team: { id: row.home_team_id, name: row.home_team_name, logo_url: row.home_team_logo },
            away_team: { id: row.away_team_id, name: row.away_team_name, logo_url: row.away_team_logo },
            competition: { id: row.competition_id, name: row.competition_name, logo_url: row.competition_logo, country_id: row.country_id },
        };
    }
    catch (error) {
        logger_1.logger.error(`[getMatchFromDb] Error fetching match ${matchId}:`, error.message);
        throw error; // Re-throw so caller can handle
    }
}
// Helper: Get lineup from database
async function getLineupFromDb(matchId) {
    const result = await connection_1.pool.query(`
    SELECT lineup_data, home_formation, away_formation
    FROM ts_matches
    WHERE external_id = $1
  `, [matchId]);
    if (result.rows.length === 0 || !result.rows[0].lineup_data)
        return null;
    const row = result.rows[0];
    return {
        home: row.lineup_data?.home || [],
        away: row.lineup_data?.away || [],
        home_formation: row.home_formation,
        away_formation: row.away_formation,
    };
}
// Helper: Get H2H from database
async function getH2HFromDb(matchId) {
    const result = await connection_1.pool.query(`
    SELECT h2h_data
    FROM ts_matches
    WHERE external_id = $1
  `, [matchId]);
    if (result.rows.length === 0 || !result.rows[0].h2h_data)
        return null;
    return result.rows[0].h2h_data;
}
// Helper: Get trend from database
async function getTrendFromDb(matchId) {
    const result = await connection_1.pool.query(`
    SELECT trend_data
    FROM ts_matches
    WHERE external_id = $1
  `, [matchId]);
    if (result.rows.length === 0 || !result.rows[0].trend_data)
        return [];
    return result.rows[0].trend_data || [];
}

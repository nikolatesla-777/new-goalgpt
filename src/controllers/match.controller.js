"use strict";
/**
 * Match Controller
 *
 * Handles HTTP requests/responses for match-related endpoints
 * NO business logic here - only request/response handling
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchFull = exports.getMatchIncidents = exports.getUnifiedMatches = exports.getMatchH2H = exports.triggerPreSync = exports.getMatchLiveStats = exports.getSeasonStandings = exports.getMatchHalfStats = exports.getMatchTrend = exports.getMatchAnalysis = exports.getLiveMatches = exports.getMatchPlayerStats = exports.getShouldBeLiveMatches = exports.getMatchTeamStats = exports.getMatchLineup = exports.getMatchSeasonRecent = exports.getMatchDetailLive = exports.getMatchById = exports.getMatchDiary = exports.getMatchRecentList = void 0;
var matchRecent_service_1 = require("../services/thesports/match/matchRecent.service");
var matchDiary_service_1 = require("../services/thesports/match/matchDiary.service");
var matchDatabase_service_1 = require("../services/thesports/match/matchDatabase.service");
var matchDetailLive_service_1 = require("../services/thesports/match/matchDetailLive.service");
var matchSeasonRecent_service_1 = require("../services/thesports/match/matchSeasonRecent.service");
var matchLineup_service_1 = require("../services/thesports/match/matchLineup.service");
var matchTeamStats_service_1 = require("../services/thesports/match/matchTeamStats.service");
var matchPlayerStats_service_1 = require("../services/thesports/match/matchPlayerStats.service");
var matchAnalysis_service_1 = require("../services/thesports/match/matchAnalysis.service");
var matchTrend_service_1 = require("../services/thesports/match/matchTrend.service");
var matchHalfStats_service_1 = require("../services/thesports/match/matchHalfStats.service");
var matchIncidents_service_1 = require("../services/thesports/match/matchIncidents.service");
var standings_service_1 = require("../services/thesports/season/standings.service");
var matchSync_service_1 = require("../services/thesports/match/matchSync.service");
var teamData_service_1 = require("../services/thesports/team/teamData.service");
var competition_service_1 = require("../services/thesports/competition/competition.service");
var combinedStats_service_1 = require("../services/thesports/match/combinedStats.service");
var logger_1 = require("../utils/logger");
var matchMinuteText_1 = require("../utils/matchMinuteText");
var liveMatchCache_service_1 = require("../services/thesports/match/liveMatchCache.service");
var matchStats_repository_1 = require("../repositories/matchStats.repository");
var matchCache_1 = require("../utils/matchCache");
var connection_1 = require("../database/connection");
var memoryCache_1 = require("../utils/cache/memoryCache");
// Initialize services with SINGLETON API client
// Services now use theSportsAPI singleton internally
var matchRecentService = new matchRecent_service_1.MatchRecentService();
var matchDiaryService = new matchDiary_service_1.MatchDiaryService();
var matchDatabaseService = new matchDatabase_service_1.MatchDatabaseService();
var matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
var matchSeasonRecentService = new matchSeasonRecent_service_1.MatchSeasonRecentService();
var matchLineupService = new matchLineup_service_1.MatchLineupService();
var matchTeamStatsService = new matchTeamStats_service_1.MatchTeamStatsService();
var matchPlayerStatsService = new matchPlayerStats_service_1.MatchPlayerStatsService();
var matchAnalysisService = new matchAnalysis_service_1.MatchAnalysisService();
var matchTrendService = new matchTrend_service_1.MatchTrendService();
var matchHalfStatsService = new matchHalfStats_service_1.MatchHalfStatsService();
var seasonStandingsService = new standings_service_1.SeasonStandingsService();
var teamDataService = new teamData_service_1.TeamDataService();
var competitionService = new competition_service_1.CompetitionService();
var matchSyncService = new matchSync_service_1.MatchSyncService(teamDataService, competitionService);
var combinedStatsService = new combinedStats_service_1.CombinedStatsService();
// --- Date helpers (TSİ bulletin) ---
var TSI_OFFSET_SECONDS = 3 * 3600;
/**
 * Returns today's date in TSİ (UTC+3) as YYYY-MM-DD and YYYYMMDD.
 * This prevents "wrong day" when the server runs in UTC.
 */
var getTodayTsi = function () {
    var tsiMs = Date.now() + TSI_OFFSET_SECONDS * 1000;
    var d = new Date(tsiMs);
    var yyyy = d.getUTCFullYear();
    var mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    var dd = String(d.getUTCDate()).padStart(2, '0');
    var dbDate = "".concat(yyyy, "-").concat(mm, "-").concat(dd);
    var apiDate = "".concat(yyyy).concat(mm).concat(dd);
    return { dbDate: dbDate, apiDate: apiDate };
};
/**
 * Normalize an incoming date (YYYY-MM-DD or YYYYMMDD) into:
 * - dbDate: YYYY-MM-DD
 * - apiDate: YYYYMMDD (TheSports /match/diary expects this)
 */
var normalizeDiaryDate = function (input) {
    if (!input)
        return getTodayTsi();
    var raw = String(input).trim();
    // YYYYMMDD
    if (/^\d{8}$/.test(raw)) {
        var dbDate = "".concat(raw.slice(0, 4), "-").concat(raw.slice(4, 6), "-").concat(raw.slice(6, 8));
        return { dbDate: dbDate, apiDate: raw };
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        var apiDate = raw.replace(/-/g, '');
        return { dbDate: raw, apiDate: apiDate };
    }
    return null;
};
/**
 * Get match recent list
 * GET /api/matches/recent
 */
var getMatchRecentList = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var query, params, result, normalizeMatch, normalizedResults, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                query = request.query;
                params = {
                    page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
                    limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
                    competition_id: query.competition_id,
                    season_id: query.season_id,
                    date: query.date,
                };
                return [4 /*yield*/, matchRecentService.getMatchRecentList(params)];
            case 1:
                result = _a.sent();
                normalizeMatch = function (match) {
                    var _a, _b, _c;
                    var statusId = (_c = (_b = (_a = match.status_id) !== null && _a !== void 0 ? _a : match.status) !== null && _b !== void 0 ? _b : match.match_status) !== null && _c !== void 0 ? _c : 1;
                    var minute = match.minute !== null && match.minute !== undefined ? Number(match.minute) : null;
                    var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
                    return __assign(__assign({}, match), { 
                        // Phase 4-4: CRITICAL - Always generate minute_text, never forward null from API/DB
                        minute_text: minuteText, minute: minute, status: statusId, status_id: statusId, match_status: statusId });
                };
                normalizedResults = (result.results || []).map(normalizeMatch);
                reply.send({
                    success: true,
                    data: __assign(__assign({}, result), { results: normalizedResults }),
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                reply.status(500).send({
                    success: false,
                    message: error_1.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMatchRecentList = getMatchRecentList;
/**
 * Get match diary
 * GET /api/matches/diary
 * CRITICAL: DB-only mode - queries database ONLY, no API fallback
 * API calls should only happen in sync workers (DailyMatchSyncWorker, etc.)
 */
var getMatchDiary = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var query, normalizedDate, dbDate, apiDate, statusFilter, cachedData, ttl_1, normalizeDbMatch, dbResult, normalized, responseData, ttl, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                query = request.query;
                normalizedDate = normalizeDiaryDate(query.date);
                if (!normalizedDate) {
                    reply.status(400).send({
                        success: false,
                        message: 'Invalid date format. Use YYYY-MM-DD or YYYYMMDD.',
                    });
                    return [2 /*return*/];
                }
                dbDate = normalizedDate.dbDate, apiDate = normalizedDate.apiDate;
                statusFilter = void 0;
                if (query.status) {
                    try {
                        statusFilter = query.status.split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n); });
                        if (statusFilter.length === 0) {
                            statusFilter = undefined;
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn("[MatchController] Invalid status filter: ".concat(query.status));
                    }
                }
                cachedData = (0, matchCache_1.getDiaryCache)(dbDate, statusFilter);
                if (cachedData) {
                    ttl_1 = (0, matchCache_1.getSmartTTL)(dbDate);
                    reply.header('Cache-Control', "public, max-age=".concat(ttl_1, ", stale-while-revalidate=").concat(ttl_1 * 2));
                    reply.header('X-Cache', 'HIT');
                    reply.send({
                        success: true,
                        data: cachedData,
                    });
                    return [2 /*return*/];
                }
                normalizeDbMatch = function (row) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
                    var externalId = (_b = (_a = row.external_id) !== null && _a !== void 0 ? _a : row.match_id) !== null && _b !== void 0 ? _b : row.id;
                    var statusId = (_e = (_d = (_c = row.status_id) !== null && _c !== void 0 ? _c : row.status) !== null && _d !== void 0 ? _d : row.match_status) !== null && _e !== void 0 ? _e : 1;
                    var homeScoreRegular = (_g = (_f = row.home_score_regular) !== null && _f !== void 0 ? _f : row.home_score) !== null && _g !== void 0 ? _g : 0;
                    var awayScoreRegular = (_j = (_h = row.away_score_regular) !== null && _h !== void 0 ? _h : row.away_score) !== null && _j !== void 0 ? _j : 0;
                    // Phase 3C: Read minute from DB and generate minute_text
                    var minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
                    var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
                    return __assign(__assign({}, row), { external_id: externalId, match_id: externalId, 
                        // Frontend expects `status` (and sometimes `match_status`) not `status_id`
                        status: statusId, match_status: statusId, status_id: statusId, 
                        // Frontend expects score fields as `home_score`/`away_score` and also reads *_regular
                        home_score_regular: (_k = row.home_score_regular) !== null && _k !== void 0 ? _k : homeScoreRegular, away_score_regular: (_l = row.away_score_regular) !== null && _l !== void 0 ? _l : awayScoreRegular, home_score: (_m = row.home_score) !== null && _m !== void 0 ? _m : homeScoreRegular, away_score: (_o = row.away_score) !== null && _o !== void 0 ? _o : awayScoreRegular, 
                        // Phase 4-4: Backend-provided minute and minute_text (ALWAYS generated, never forward DB null)
                        minute: minute, minute_text: minuteText, 
                        // Kickoff time (kept for backward compatibility, but frontend should not use for calculation)
                        live_kickoff_time: (_q = (_p = row.live_kickoff_time) !== null && _p !== void 0 ? _p : row.match_time) !== null && _q !== void 0 ? _q : null, 
                        // Ensure numeric incident fields are not undefined
                        home_red_cards: (_r = row.home_red_cards) !== null && _r !== void 0 ? _r : null, away_red_cards: (_s = row.away_red_cards) !== null && _s !== void 0 ? _s : null, home_yellow_cards: (_t = row.home_yellow_cards) !== null && _t !== void 0 ? _t : null, away_yellow_cards: (_u = row.away_yellow_cards) !== null && _u !== void 0 ? _u : null, home_corners: (_v = row.home_corners) !== null && _v !== void 0 ? _v : null, away_corners: (_w = row.away_corners) !== null && _w !== void 0 ? _w : null });
                };
                return [4 /*yield*/, matchDatabaseService.getMatchesByDate(dbDate, statusFilter)];
            case 1:
                dbResult = _a.sent();
                normalized = (dbResult.results || []).map(normalizeDbMatch);
                logger_1.logger.info("\uD83D\uDCCA [MatchDiary] Returning ".concat(normalized.length, " matches from database for ").concat(dbDate, " (DB-only mode, no API fallback)"));
                responseData = __assign(__assign({}, dbResult), { results: normalized });
                // CACHE: Save to cache for future requests
                (0, matchCache_1.setDiaryCache)(dbDate, statusFilter, responseData);
                ttl = (0, matchCache_1.getSmartTTL)(dbDate);
                reply.header('Cache-Control', "public, max-age=".concat(ttl, ", stale-while-revalidate=").concat(ttl * 2));
                reply.header('X-Cache', 'MISS');
                reply.send({
                    success: true,
                    data: responseData,
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                reply.status(500).send({
                    success: false,
                    message: error_2.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMatchDiary = getMatchDiary;
/**
 * Get single match by ID
 * GET /api/matches/:match_id
 * Fetches match from database by external_id
 *
 * CRITICAL: No cache - always fetches fresh from database
 * Match status can change rapidly, cache would cause stale data
 */
var getMatchById = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, pool_1, client, query, result, row, generateMinuteText_1, validatedStatus, now, matchTime, minute, minuteText, finalHomeScore, finalAwayScore, incidentsQuery, incidents, i, incident, incidentsError_1, match, error_3;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    return __generator(this, function (_r) {
        switch (_r.label) {
            case 0:
                _r.trys.push([0, 12, , 13]);
                match_id = request.params.match_id;
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../database/connection')); })];
            case 1:
                pool_1 = (_r.sent()).pool;
                return [4 /*yield*/, pool_1.connect()];
            case 2:
                client = _r.sent();
                _r.label = 3;
            case 3:
                _r.trys.push([3, , 10, 11]);
                query = "\n        SELECT \n          m.external_id as id,\n          m.competition_id,\n          m.season_id,\n          m.match_time,\n          m.status_id as status_id,\n          m.minute,\n          m.updated_at,\n          m.provider_update_time,\n          m.last_event_ts,\n          m.home_team_id,\n          m.away_team_id,\n          -- CRITICAL FIX: Use COALESCE to get score from multiple sources\n          -- Priority: home_score_display > home_scores[0] > home_score_regular > 0\n          COALESCE(\n            m.home_score_display,\n            (m.home_scores->0)::INTEGER,\n            m.home_score_regular,\n            0\n          ) as home_score,\n          COALESCE(\n            m.away_score_display,\n            (m.away_scores->0)::INTEGER,\n            m.away_score_regular,\n            0\n          ) as away_score,\n          m.home_score_overtime,\n          m.away_score_overtime,\n          m.home_score_penalties,\n          m.away_score_penalties,\n          m.home_score_display,\n          m.away_score_display,\n          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,\n          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,\n          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,\n          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,\n          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,\n          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,\n          COALESCE(\n            CASE \n              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time \n              THEN m.live_kickoff_time \n              ELSE m.match_time \n            END,\n            m.match_time\n          ) as live_kickoff_time,\n          ht.name as home_team_name,\n          ht.logo_url as home_team_logo,\n          at.name as away_team_name,\n          at.logo_url as away_team_logo,\n          c.name as competition_name,\n          c.logo_url as competition_logo,\n          c.country_id as competition_country_id\n        FROM ts_matches m\n        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n        WHERE m.external_id = $1\n      ";
                return [4 /*yield*/, client.query(query, [match_id])];
            case 4:
                result = _r.sent();
                if (result.rows.length === 0) {
                    reply.status(404).send({
                        success: false,
                        message: 'Match not found',
                    });
                    return [2 /*return*/];
                }
                row = result.rows[0];
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../utils/matchMinuteText')); })];
            case 5:
                generateMinuteText_1 = (_r.sent()).generateMinuteText;
                validatedStatus = (_a = row.status_id) !== null && _a !== void 0 ? _a : 0;
                now = Math.floor(Date.now() / 1000);
                matchTime = row.match_time;
                // CRITICAL FIX: Status güncellemesi sadece background worker'lar tarafından yapılmalı
                // getMatchById endpoint'i sadece database'den okur, reconcile yapmaz
                // Bu tutarlılık sağlar: Ana sayfa ve detay sayfası aynı veriyi gösterir
                // Status güncellemesi MatchWatchdogWorker ve DataUpdateWorker tarafından yapılır
                // CRITICAL FIX: Future matches cannot have END status
                if (matchTime && matchTime > now) {
                    if (validatedStatus === 8 || validatedStatus === 12) {
                        validatedStatus = 1; // NOT_STARTED
                        logger_1.logger.warn("[getMatchById] Future match ".concat(match_id, " had END status, corrected to NOT_STARTED"));
                    }
                }
                minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
                minuteText = generateMinuteText_1(minute, validatedStatus);
                finalHomeScore = (_b = row.home_score) !== null && _b !== void 0 ? _b : null;
                finalAwayScore = (_c = row.away_score) !== null && _c !== void 0 ? _c : null;
                if (!((finalHomeScore === null || finalHomeScore === 0) && (finalAwayScore === null || finalAwayScore === 0))) return [3 /*break*/, 9];
                _r.label = 6;
            case 6:
                _r.trys.push([6, 8, , 9]);
                return [4 /*yield*/, client.query('SELECT incidents FROM ts_matches WHERE external_id = $1', [match_id])];
            case 7:
                incidentsQuery = _r.sent();
                if (incidentsQuery.rows.length > 0 && incidentsQuery.rows[0].incidents) {
                    incidents = incidentsQuery.rows[0].incidents;
                    if (Array.isArray(incidents) && incidents.length > 0) {
                        // Find the last incident with score information
                        for (i = incidents.length - 1; i >= 0; i--) {
                            incident = incidents[i];
                            if (incident && typeof incident === 'object' &&
                                (incident.home_score !== undefined || incident.away_score !== undefined)) {
                                finalHomeScore = (_d = incident.home_score) !== null && _d !== void 0 ? _d : finalHomeScore;
                                finalAwayScore = (_e = incident.away_score) !== null && _e !== void 0 ? _e : finalAwayScore;
                                logger_1.logger.info("[getMatchById] Extracted score from incidents for ".concat(match_id, ": ").concat(finalHomeScore, "-").concat(finalAwayScore));
                                break; // Use the last (most recent) incident with score
                            }
                        }
                    }
                }
                return [3 /*break*/, 9];
            case 8:
                incidentsError_1 = _r.sent();
                // If incidents extraction fails, use original score
                logger_1.logger.debug("[getMatchById] Failed to extract score from incidents for ".concat(match_id, ": ").concat(incidentsError_1.message));
                return [3 /*break*/, 9];
            case 9:
                match = {
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
                    home_score_overtime: ((_f = row.home_score_overtime) !== null && _f !== void 0 ? _f : 0),
                    away_score_overtime: ((_g = row.away_score_overtime) !== null && _g !== void 0 ? _g : 0),
                    home_score_penalties: ((_h = row.home_score_penalties) !== null && _h !== void 0 ? _h : 0),
                    away_score_penalties: ((_j = row.away_score_penalties) !== null && _j !== void 0 ? _j : 0),
                    home_red_cards: ((_k = row.home_red_cards) !== null && _k !== void 0 ? _k : 0),
                    away_red_cards: ((_l = row.away_red_cards) !== null && _l !== void 0 ? _l : 0),
                    home_yellow_cards: ((_m = row.home_yellow_cards) !== null && _m !== void 0 ? _m : 0),
                    away_yellow_cards: ((_o = row.away_yellow_cards) !== null && _o !== void 0 ? _o : 0),
                    home_corners: ((_p = row.home_corners) !== null && _p !== void 0 ? _p : 0),
                    away_corners: ((_q = row.away_corners) !== null && _q !== void 0 ? _q : 0),
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
                return [3 /*break*/, 11];
            case 10:
                client.release();
                return [7 /*endfinally*/];
            case 11: return [3 /*break*/, 13];
            case 12:
                error_3 = _r.sent();
                logger_1.logger.error('[MatchController] Error in getMatchById:', error_3);
                reply.status(500).send({
                    success: false,
                    message: error_3.message || 'Internal server error',
                });
                return [3 /*break*/, 13];
            case 13: return [2 /*return*/];
        }
    });
}); };
exports.getMatchById = getMatchById;
/**
 * Get match detail live (incidents, stats, score)
 * GET /api/matches/:match_id/detail-live
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
var getMatchDetailLive = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id_1, isFinished, dbResult, params, result, apiPromise, timeoutPromise, err_1, matchData, existingStats, newStats, error_4;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 10, , 11]);
                match_id_1 = request.params.match_id;
                return [4 /*yield*/, combinedStatsService.isMatchFinished(match_id_1)];
            case 1:
                isFinished = _b.sent();
                if (!isFinished) return [3 /*break*/, 3];
                return [4 /*yield*/, combinedStatsService.getCombinedStatsFromDatabase(match_id_1)];
            case 2:
                dbResult = _b.sent();
                if (dbResult && (dbResult.incidents.length > 0 || dbResult.allStats.length > 0)) {
                    logger_1.logger.debug("[MatchController] Match finished, returning detail-live from DB for ".concat(match_id_1));
                    reply.send({
                        success: true,
                        data: {
                            results: [{
                                    id: match_id_1,
                                    incidents: dbResult.incidents,
                                    stats: dbResult.allStats,
                                    score: dbResult.score,
                                }],
                            source: 'database (match finished)'
                        },
                    });
                    return [2 /*return*/];
                }
                // Finished but no DB data - return empty immediately (don't wait for slow API)
                logger_1.logger.warn("[MatchController] Match finished but no DB data for detail-live ".concat(match_id_1, ", returning empty"));
                reply.send({
                    success: true,
                    data: {
                        results: [{ id: match_id_1, incidents: [], stats: [], score: null }],
                        source: 'database (no data available)'
                    },
                });
                return [2 /*return*/];
            case 3:
                params = { match_id: match_id_1 };
                result = null;
                _b.label = 4;
            case 4:
                _b.trys.push([4, 6, , 7]);
                apiPromise = matchDetailLiveService.getMatchDetailLive(params);
                timeoutPromise = new Promise(function (_, reject) {
                    return setTimeout(function () { return reject(new Error('API timeout')); }, 2000);
                });
                return [4 /*yield*/, Promise.race([apiPromise, timeoutPromise])];
            case 5:
                result = _b.sent();
                return [3 /*break*/, 7];
            case 6:
                err_1 = _b.sent();
                logger_1.logger.warn("[MatchController] detail-live API timeout for ".concat(match_id_1, ": ").concat(err_1.message));
                // Return empty on timeout
                reply.send({
                    success: true,
                    data: {
                        results: [{ id: match_id_1, incidents: [], stats: [], score: null }],
                        source: 'timeout (API too slow)'
                    },
                });
                return [2 /*return*/];
            case 7:
                if (!((result === null || result === void 0 ? void 0 : result.results) && Array.isArray(result.results))) return [3 /*break*/, 9];
                matchData = result.results.find(function (r) { return r.id === match_id_1; }) || result.results[0];
                if (!(((_a = matchData === null || matchData === void 0 ? void 0 : matchData.incidents) === null || _a === void 0 ? void 0 : _a.length) > 0)) return [3 /*break*/, 9];
                return [4 /*yield*/, combinedStatsService.getCombinedStatsFromDatabase(match_id_1)];
            case 8:
                existingStats = _b.sent();
                if (existingStats) {
                    existingStats.incidents = matchData.incidents;
                    existingStats.score = matchData.score || existingStats.score;
                    combinedStatsService.saveCombinedStatsToDatabase(match_id_1, existingStats).catch(function (err) {
                        logger_1.logger.error("[MatchController] Failed to save incidents to DB for ".concat(match_id_1, ":"), err);
                    });
                }
                else {
                    newStats = {
                        matchId: match_id_1,
                        basicStats: [],
                        detailedStats: [],
                        allStats: [],
                        incidents: matchData.incidents,
                        score: matchData.score || null,
                        lastUpdated: Date.now(),
                    };
                    combinedStatsService.saveCombinedStatsToDatabase(match_id_1, newStats).catch(function (err) {
                        logger_1.logger.error("[MatchController] Failed to save incidents to DB for ".concat(match_id_1, ":"), err);
                    });
                }
                _b.label = 9;
            case 9:
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 11];
            case 10:
                error_4 = _b.sent();
                logger_1.logger.error('[MatchController] Error in getMatchDetailLive:', error_4);
                reply.status(500).send({
                    success: false,
                    message: error_4.message || 'Internal server error',
                });
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); };
exports.getMatchDetailLive = getMatchDetailLive;
/**
 * Get match season recent
 * GET /api/matches/season/recent
 */
var getMatchSeasonRecent = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var query, params, result, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                query = request.query;
                params = {
                    season_id: String(query.season_id),
                    page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
                    limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
                };
                return [4 /*yield*/, matchSeasonRecentService.getMatchSeasonRecent(params)];
            case 1:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                reply.status(500).send({
                    success: false,
                    message: error_5.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMatchSeasonRecent = getMatchSeasonRecent;
/**
 * Get match lineup (reads from database first, then API fallback)
 * GET /api/matches/:match_id/lineup
 */
var getMatchLineup = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, DailyPreSyncService, preSyncService, lineupData, syncError_1, params, apiResult, homeLineup, awayLineup, homeSubs, awaySubs, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 10, , 11]);
                match_id = request.params.match_id;
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../services/thesports/sync/dailyPreSync.service')); })];
            case 1:
                DailyPreSyncService = (_a.sent()).DailyPreSyncService;
                preSyncService = new DailyPreSyncService();
                return [4 /*yield*/, preSyncService.getLineupFromDb(match_id)];
            case 2:
                lineupData = _a.sent();
                if (!!lineupData) return [3 /*break*/, 7];
                logger_1.logger.info("Lineup not in DB for ".concat(match_id, ", fetching from API"));
                _a.label = 3;
            case 3:
                _a.trys.push([3, 6, , 7]);
                return [4 /*yield*/, preSyncService.syncLineupToDb(match_id)];
            case 4:
                _a.sent();
                return [4 /*yield*/, preSyncService.getLineupFromDb(match_id)];
            case 5:
                lineupData = _a.sent();
                return [3 /*break*/, 7];
            case 6:
                syncError_1 = _a.sent();
                logger_1.logger.warn("Failed to sync lineup for ".concat(match_id, ": ").concat(syncError_1.message));
                return [3 /*break*/, 7];
            case 7:
                if (!!lineupData) return [3 /*break*/, 9];
                logger_1.logger.info("Lineup still not in DB for ".concat(match_id, ", trying API directly"));
                params = { match_id: match_id };
                return [4 /*yield*/, matchLineupService.getMatchLineup(params)];
            case 8:
                apiResult = _a.sent();
                reply.send({
                    success: true,
                    data: apiResult,
                });
                return [2 /*return*/];
            case 9:
                homeLineup = lineupData.home_lineup || [];
                awayLineup = lineupData.away_lineup || [];
                homeSubs = lineupData.home_subs || [];
                awaySubs = lineupData.away_subs || [];
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
                return [3 /*break*/, 11];
            case 10:
                error_6 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getMatchLineup:', error_6);
                reply.status(500).send({
                    success: false,
                    message: error_6.message || 'Internal server error',
                });
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); };
exports.getMatchLineup = getMatchLineup;
/**
 * Get match team stats
 * GET /api/matches/:match_id/team-stats
 */
var getMatchTeamStats = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, params, result, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                match_id = request.params.match_id;
                params = { match_id: match_id };
                return [4 /*yield*/, matchTeamStatsService.getMatchTeamStats(params)];
            case 1:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                reply.status(500).send({
                    success: false,
                    message: error_7.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMatchTeamStats = getMatchTeamStats;
/**
 * Get should-be-live matches (ops/debug endpoint)
 * GET /api/matches/should-be-live?maxMinutesAgo=120
 *
 * Phase 5-S: Returns matches with status_id=1 but match_time has passed.
 * These are candidates for watchdog reconciliation.
 * NOT used by frontend live view - only for ops/debug visibility.
 */
var getShouldBeLiveMatches = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var maxMinutesAgo, limit, result, normalizeDbMatch, normalized, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                maxMinutesAgo = request.query.maxMinutesAgo ? parseInt(request.query.maxMinutesAgo, 10) : 120;
                limit = request.query.limit ? parseInt(request.query.limit, 10) : 200;
                return [4 /*yield*/, matchDatabaseService.getShouldBeLiveMatches(maxMinutesAgo, limit)];
            case 1:
                result = _a.sent();
                normalizeDbMatch = function (row) {
                    var _a, _b, _c, _d, _e;
                    var externalId = (_b = (_a = row.external_id) !== null && _a !== void 0 ? _a : row.match_id) !== null && _b !== void 0 ? _b : row.id;
                    var statusId = (_e = (_d = (_c = row.status_id) !== null && _c !== void 0 ? _c : row.status) !== null && _d !== void 0 ? _d : row.match_status) !== null && _e !== void 0 ? _e : 1;
                    var minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
                    var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
                    return __assign(__assign({}, row), { external_id: externalId, match_id: externalId, status: statusId, match_status: statusId, status_id: statusId, minute: minute, minute_text: minuteText, updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString() });
                };
                normalized = (result.results || []).map(normalizeDbMatch);
                reply.send({
                    success: true,
                    data: {
                        results: normalized,
                        total: normalized.length,
                        maxMinutesAgo: maxMinutesAgo,
                        limit: limit,
                    },
                });
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getShouldBeLiveMatches:', error_8);
                reply.status(500).send({
                    success: false,
                    message: error_8.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getShouldBeLiveMatches = getShouldBeLiveMatches;
/**
 * Get match player stats
 * GET /api/matches/:match_id/player-stats
 */
var getMatchPlayerStats = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, params, result, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                match_id = request.params.match_id;
                params = { match_id: match_id };
                return [4 /*yield*/, matchPlayerStatsService.getMatchPlayerStats(params)];
            case 1:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                reply.status(500).send({
                    success: false,
                    message: error_9.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
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
var getLiveMatches = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var normalizeDbMatch, dbResult, normalized, responseData, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                normalizeDbMatch = function (row) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                    var externalId = (_b = (_a = row.external_id) !== null && _a !== void 0 ? _a : row.match_id) !== null && _b !== void 0 ? _b : row.id;
                    var statusId = (_e = (_d = (_c = row.status_id) !== null && _c !== void 0 ? _c : row.status) !== null && _d !== void 0 ? _d : row.match_status) !== null && _e !== void 0 ? _e : 1;
                    // PHASE 7: Database query fixed to read home_score_display directly
                    // No fallback needed - database returns COALESCE(home_score_display, 0) as home_score
                    var homeScoreDisplay = (_f = row.home_score) !== null && _f !== void 0 ? _f : 0;
                    var awayScoreDisplay = (_g = row.away_score) !== null && _g !== void 0 ? _g : 0;
                    // Phase 3C: Read minute from DB and generate minute_text
                    var minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
                    var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
                    return __assign(__assign({}, row), { external_id: externalId, match_id: externalId, status: statusId, match_status: statusId, status_id: statusId, home_score_regular: homeScoreDisplay, away_score_regular: awayScoreDisplay, home_score: homeScoreDisplay, away_score: awayScoreDisplay, 
                        // Phase 4-4: Backend-provided minute and minute_text (ALWAYS generated, never forward DB null)
                        minute: minute, minute_text: minuteText, 
                        // Kickoff time (kept for backward compatibility, but frontend should not use for calculation)
                        live_kickoff_time: (_j = (_h = row.live_kickoff_time) !== null && _h !== void 0 ? _h : row.match_time) !== null && _j !== void 0 ? _j : null, home_red_cards: (_k = row.home_red_cards) !== null && _k !== void 0 ? _k : null, away_red_cards: (_l = row.away_red_cards) !== null && _l !== void 0 ? _l : null, home_yellow_cards: (_m = row.home_yellow_cards) !== null && _m !== void 0 ? _m : null, away_yellow_cards: (_o = row.away_yellow_cards) !== null && _o !== void 0 ? _o : null, home_corners: (_p = row.home_corners) !== null && _p !== void 0 ? _p : null, away_corners: (_q = row.away_corners) !== null && _q !== void 0 ? _q : null });
                };
                return [4 /*yield*/, matchDatabaseService.getLiveMatches()];
            case 1:
                dbResult = _a.sent();
                normalized = dbResult.results.map(normalizeDbMatch);
                responseData = {
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
                return [3 /*break*/, 3];
            case 2:
                error_10 = _a.sent();
                reply.status(500).send({
                    success: false,
                    message: error_10.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getLiveMatches = getLiveMatches;
/**
 * Get match analysis (H2H)
 * GET /api/matches/:match_id/analysis
 */
var getMatchAnalysis = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, params, result, error_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                match_id = request.params.match_id;
                params = { match_id: match_id };
                return [4 /*yield*/, matchAnalysisService.getMatchAnalysis(params)];
            case 1:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 3];
            case 2:
                error_11 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getMatchAnalysis:', error_11);
                reply.status(500).send({
                    success: false,
                    message: error_11.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getMatchAnalysis = getMatchAnalysis;
/**
 * Get match trend (minute-by-minute data)
 * GET /api/matches/:match_id/trend
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
var getMatchTrend = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id_2, params, pool_2, client, matchStatus, result_1, isFinished, dbTrend, result, trendPromise, timeoutPromise, err_2, error_12;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 13, , 14]);
                match_id_2 = request.params.match_id;
                params = { match_id: match_id_2 };
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../database/connection')); })];
            case 1:
                pool_2 = (_a.sent()).pool;
                return [4 /*yield*/, pool_2.connect()];
            case 2:
                client = _a.sent();
                matchStatus = void 0;
                _a.label = 3;
            case 3:
                _a.trys.push([3, , 5, 6]);
                return [4 /*yield*/, client.query('SELECT status_id FROM ts_matches WHERE external_id = $1', [match_id_2])];
            case 4:
                result_1 = _a.sent();
                if (result_1.rows.length > 0) {
                    matchStatus = result_1.rows[0].status_id;
                }
                return [3 /*break*/, 6];
            case 5:
                client.release();
                return [7 /*endfinally*/];
            case 6:
                isFinished = matchStatus === 8;
                if (!isFinished) return [3 /*break*/, 8];
                return [4 /*yield*/, getTrendFromDatabase(match_id_2)];
            case 7:
                dbTrend = _a.sent();
                if (dbTrend && dbTrend.results && dbTrend.results.length > 0) {
                    logger_1.logger.debug("[MatchController] Match finished, returning trend from DB for ".concat(match_id_2));
                    reply.send({
                        success: true,
                        data: __assign(__assign({}, dbTrend), { source: 'database (match finished)' }),
                    });
                    return [2 /*return*/];
                }
                _a.label = 8;
            case 8:
                result = null;
                _a.label = 9;
            case 9:
                _a.trys.push([9, 11, , 12]);
                trendPromise = matchTrendService.getMatchTrend(params, matchStatus);
                timeoutPromise = new Promise(function (_, reject) {
                    return setTimeout(function () { return reject(new Error('Trend API timeout')); }, 2000);
                });
                return [4 /*yield*/, Promise.race([trendPromise, timeoutPromise])];
            case 10:
                result = _a.sent();
                return [3 /*break*/, 12];
            case 11:
                err_2 = _a.sent();
                logger_1.logger.warn("[MatchController] Trend API timeout for ".concat(match_id_2, ": ").concat(err_2.message));
                // Return empty on timeout
                reply.send({
                    success: true,
                    data: { results: [] },
                });
                return [2 /*return*/];
            case 12:
                // Save trend data to database for persistence
                if ((result === null || result === void 0 ? void 0 : result.results) && Array.isArray(result.results) && result.results.length > 0) {
                    saveTrendToDatabase(match_id_2, result).catch(function (err) {
                        logger_1.logger.error("[MatchController] Failed to save trend to DB for ".concat(match_id_2, ":"), err);
                    });
                }
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 14];
            case 13:
                error_12 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getMatchTrend:', error_12);
                reply.status(500).send({
                    success: false,
                    message: error_12.message || 'Internal server error',
                });
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); };
exports.getMatchTrend = getMatchTrend;
// Helper function to get trend from database
// CRITICAL FIX: Read from trend_data column (not statistics->'trend')
// PostMatchProcessor writes to trend_data column
function getTrendFromDatabase(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var pool, client, result, trendData, error_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../database/connection')); })];
                case 1:
                    pool = (_a.sent()).pool;
                    return [4 /*yield*/, pool.connect()];
                case 2:
                    client = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, 6, 7]);
                    return [4 /*yield*/, client.query("\n      SELECT trend_data\n      FROM ts_matches\n      WHERE external_id = $1\n        AND trend_data IS NOT NULL\n    ", [matchId])];
                case 4:
                    result = _a.sent();
                    if (result.rows.length === 0 || !result.rows[0].trend_data) {
                        return [2 /*return*/, null];
                    }
                    trendData = result.rows[0].trend_data;
                    // If it's already in the correct format, return it
                    if (trendData && typeof trendData === 'object') {
                        // Check if it's already wrapped in results
                        if (Array.isArray(trendData)) {
                            return [2 /*return*/, { results: trendData }];
                        }
                        // If it's an object with first_half/second_half, wrap it
                        if (trendData.first_half || trendData.second_half) {
                            return [2 /*return*/, { results: [trendData] }];
                        }
                        // Otherwise wrap in results array
                        return [2 /*return*/, { results: [trendData] }];
                    }
                    return [2 /*return*/, { results: trendData }];
                case 5:
                    error_13 = _a.sent();
                    logger_1.logger.error("[MatchController] Error reading trend from database for ".concat(matchId, ":"), error_13);
                    return [2 /*return*/, null];
                case 6:
                    client.release();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Helper function to save trend to database
function saveTrendToDatabase(matchId, trendData) {
    return __awaiter(this, void 0, void 0, function () {
        var pool, client, existingResult, existingStats, statisticsData, error_14;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../database/connection')); })];
                case 1:
                    pool = (_b.sent()).pool;
                    return [4 /*yield*/, pool.connect()];
                case 2:
                    client = _b.sent();
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 6, 7, 8]);
                    return [4 /*yield*/, client.query("\n      SELECT statistics FROM ts_matches WHERE external_id = $1\n    ", [matchId])];
                case 4:
                    existingResult = _b.sent();
                    existingStats = ((_a = existingResult.rows[0]) === null || _a === void 0 ? void 0 : _a.statistics) || {};
                    statisticsData = __assign(__assign({}, existingStats), { trend: trendData, last_updated: Date.now() });
                    // Update statistics column
                    return [4 /*yield*/, client.query("\n      UPDATE ts_matches\n      SET statistics = $1::jsonb,\n          updated_at = NOW()\n      WHERE external_id = $2\n    ", [JSON.stringify(statisticsData), matchId])];
                case 5:
                    // Update statistics column
                    _b.sent();
                    logger_1.logger.info("[MatchController] Saved trend data to database for match: ".concat(matchId));
                    return [3 /*break*/, 8];
                case 6:
                    error_14 = _b.sent();
                    logger_1.logger.error("[MatchController] Error saving trend to database for ".concat(matchId, ":"), error_14);
                    return [3 /*break*/, 8];
                case 7:
                    client.release();
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get match half stats (first half / second half breakdown)
 * GET /api/matches/:match_id/half-stats
 *
 * CRITICAL: For finished matches, returns from database (API doesn't return data after match ends)
 */
var getMatchHalfStats = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id_3, isFinished, dbHalfStats, params, result, halfTimeStats, error_15;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                match_id_3 = request.params.match_id;
                return [4 /*yield*/, combinedStatsService.isMatchFinished(match_id_3)];
            case 1:
                isFinished = _a.sent();
                if (!isFinished) return [3 /*break*/, 3];
                return [4 /*yield*/, combinedStatsService.getHalfTimeStatsFromDatabase(match_id_3)];
            case 2:
                dbHalfStats = _a.sent();
                if (dbHalfStats) {
                    logger_1.logger.debug("[MatchController] Match finished, returning half-stats from DB for ".concat(match_id_3));
                    reply.send({
                        success: true,
                        data: {
                            results: [
                                __assign({ Sign: 'ft' }, convertStatsArrayToObject(dbHalfStats.fullTime)),
                                __assign({ Sign: 'p1' }, convertStatsArrayToObject(dbHalfStats.firstHalf)),
                                __assign({ Sign: 'p2' }, convertStatsArrayToObject(dbHalfStats.secondHalf)),
                            ],
                            source: 'database (match finished)'
                        },
                    });
                    return [2 /*return*/];
                }
                logger_1.logger.warn("[MatchController] Match finished but no half-stats in DB for ".concat(match_id_3, ", trying API"));
                _a.label = 3;
            case 3:
                params = { match_id: match_id_3 };
                return [4 /*yield*/, matchHalfStatsService.getMatchHalfStatsDetail(params)];
            case 4:
                result = _a.sent();
                // Parse and save half-time stats to database
                if ((result === null || result === void 0 ? void 0 : result.results) && Array.isArray(result.results) && result.results.length > 0) {
                    try {
                        halfTimeStats = parseHalfTimeStatsFromApiResponse(result.results);
                        if (halfTimeStats) {
                            combinedStatsService.saveHalfTimeStatsToDatabase(match_id_3, halfTimeStats).catch(function (err) {
                                logger_1.logger.error("[MatchController] Failed to save half-stats to DB for ".concat(match_id_3, ":"), err);
                            });
                        }
                    }
                    catch (parseErr) {
                        logger_1.logger.warn("[MatchController] Failed to parse half-stats for ".concat(match_id_3, ":"), parseErr);
                    }
                }
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 6];
            case 5:
                error_15 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getMatchHalfStats:', error_15);
                reply.status(500).send({
                    success: false,
                    message: error_15.message || 'Internal server error',
                });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.getMatchHalfStats = getMatchHalfStats;
// Helper function to convert stats array to object format for API response
function convertStatsArrayToObject(stats) {
    var _a, _b;
    var result = {};
    if (!stats || !Array.isArray(stats))
        return result;
    for (var _i = 0, stats_1 = stats; _i < stats_1.length; _i++) {
        var stat = stats_1[_i];
        if (stat.type !== undefined) {
            result[String(stat.type)] = [(_a = stat.home) !== null && _a !== void 0 ? _a : 0, (_b = stat.away) !== null && _b !== void 0 ? _b : 0];
        }
    }
    return result;
}
// Helper function to parse half-time stats from API response
function parseHalfTimeStatsFromApiResponse(results) {
    var _a, _b;
    if (!results || !Array.isArray(results))
        return null;
    var firstHalf = [];
    var secondHalf = [];
    var fullTime = [];
    for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
        var item = results_1[_i];
        var sign = item.Sign;
        if (!sign)
            continue;
        var stats = [];
        for (var _c = 0, _d = Object.entries(item); _c < _d.length; _c++) {
            var _e = _d[_c], key = _e[0], value = _e[1];
            if (key === 'Sign')
                continue;
            var typeId = Number(key);
            if (isNaN(typeId))
                continue;
            var values = Array.isArray(value) ? value : [];
            if (values.length >= 2) {
                stats.push({
                    type: typeId,
                    home: (_a = values[0]) !== null && _a !== void 0 ? _a : 0,
                    away: (_b = values[1]) !== null && _b !== void 0 ? _b : 0,
                });
            }
        }
        if (sign === 'p1') {
            firstHalf.push.apply(firstHalf, stats);
        }
        else if (sign === 'p2') {
            secondHalf.push.apply(secondHalf, stats);
        }
        else if (sign === 'ft') {
            fullTime.push.apply(fullTime, stats);
        }
    }
    return { firstHalf: firstHalf, secondHalf: secondHalf, fullTime: fullTime };
}
/**
 * Get season standings
 * GET /api/seasons/:season_id/standings
 */
var getSeasonStandings = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var season_id, params, result, error_16;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                season_id = request.params.season_id;
                params = { season_id: season_id };
                return [4 /*yield*/, seasonStandingsService.getSeasonStandings(params)];
            case 1:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 3];
            case 2:
                error_16 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getSeasonStandings:', error_16);
                reply.status(500).send({
                    success: false,
                    message: error_16.message || 'Internal server error',
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
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
var getMatchLiveStats = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id_4, isFinished, dbResult, firstHalfStats_1, secondHalfStats_1, matchStatus, isHalfTime, isSecondHalf, firstHalfStats, secondHalfStats, dbStats, statsArray, cachedLiveDetail, result, apiUrl, controller_1, timeoutId, response, liveData, matchData, STAT_NAMES_1, allStats, incidents, score, err_3, error_17;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 18, , 19]);
                match_id_4 = request.params.match_id;
                return [4 /*yield*/, combinedStatsService.isMatchFinished(match_id_4)];
            case 1:
                isFinished = _c.sent();
                if (!isFinished) return [3 /*break*/, 5];
                return [4 /*yield*/, combinedStatsService.getCombinedStatsFromDatabase(match_id_4)];
            case 2:
                dbResult = _c.sent();
                return [4 /*yield*/, combinedStatsService.getFirstHalfStats(match_id_4)];
            case 3:
                firstHalfStats_1 = _c.sent();
                return [4 /*yield*/, combinedStatsService.getSecondHalfStats(match_id_4)];
            case 4:
                secondHalfStats_1 = _c.sent();
                if (dbResult && dbResult.allStats.length > 0) {
                    logger_1.logger.debug("[MatchController] Match finished, returning stats from DB for ".concat(match_id_4));
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
                            firstHalfStats: firstHalfStats_1 || null,
                            secondHalfStats: secondHalfStats_1 || null,
                            halfTime: dbResult.halfTimeStats || null,
                            incidents: dbResult.incidents,
                            score: dbResult.score,
                            sources: {
                                basic: dbResult.basicStats.length,
                                detailed: dbResult.detailedStats.length,
                                from: 'database (match finished)',
                                hasFirstHalfSnapshot: !!firstHalfStats_1,
                                hasSecondHalfSnapshot: !!secondHalfStats_1,
                            },
                        },
                    });
                    return [2 /*return*/];
                }
                // Finished but no DB data - return empty immediately (don't wait for API)
                // TheSportsAPI doesn't return data for finished matches anyway
                logger_1.logger.warn("[MatchController] Match finished but no DB data for ".concat(match_id_4, ", returning empty"));
                reply.send({
                    success: true,
                    data: {
                        match_id: match_id_4,
                        match_status: 8,
                        stats: [],
                        fullTime: { stats: [], results: [] },
                        firstHalfStats: firstHalfStats_1 || null,
                        secondHalfStats: secondHalfStats_1 || null,
                        halfTime: null,
                        incidents: [],
                        score: null,
                        sources: { basic: 0, detailed: 0, from: 'database (no data available)' },
                    },
                });
                return [2 /*return*/];
            case 5: return [4 /*yield*/, combinedStatsService.getMatchStatus(match_id_4)];
            case 6:
                matchStatus = _c.sent();
                isHalfTime = matchStatus === 3;
                isSecondHalf = matchStatus === 4 || matchStatus === 5 || matchStatus === 7;
                return [4 /*yield*/, combinedStatsService.getFirstHalfStats(match_id_4)];
            case 7:
                firstHalfStats = _c.sent();
                return [4 /*yield*/, combinedStatsService.getSecondHalfStats(match_id_4)];
            case 8:
                secondHalfStats = _c.sent();
                return [4 /*yield*/, matchStats_repository_1.matchStatsRepository.getStats(match_id_4)];
            case 9:
                dbStats = _c.sent();
                if (dbStats && (dbStats.home_corner !== 0 || dbStats.away_corner !== 0 ||
                    dbStats.home_shots !== 0 || dbStats.away_shots !== 0 ||
                    dbStats.home_yellow_cards !== 0 || dbStats.away_yellow_cards !== 0)) {
                    logger_1.logger.debug("[MatchController] \u26A1 DB-FIRST: Returning stats from ts_match_stats for ".concat(match_id_4));
                    statsArray = [
                        { type: 2, home: dbStats.home_corner, away: dbStats.away_corner, name: 'Corner Kicks', nameTr: 'Korner' },
                        { type: 3, home: dbStats.home_yellow_cards, away: dbStats.away_yellow_cards, name: 'Yellow Cards', nameTr: 'Sarı Kart' },
                        { type: 4, home: dbStats.home_red_cards, away: dbStats.away_red_cards, name: 'Red Cards', nameTr: 'Kırmızı Kart' },
                        { type: 21, home: dbStats.home_shots_on_target, away: dbStats.away_shots_on_target, name: 'Shots on Target', nameTr: 'İsabetli Şut' },
                        { type: 22, home: (dbStats.home_shots || 0) - (dbStats.home_shots_on_target || 0), away: (dbStats.away_shots || 0) - (dbStats.away_shots_on_target || 0), name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
                        { type: 23, home: dbStats.home_attacks, away: dbStats.away_attacks, name: 'Attacks', nameTr: 'Atak' },
                        { type: 24, home: dbStats.home_dangerous_attacks, away: dbStats.away_dangerous_attacks, name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
                        { type: 25, home: dbStats.home_possession, away: dbStats.away_possession, name: 'Ball Possession (%)', nameTr: 'Top Hakimiyeti' },
                    ].filter(function (s) { return s.home !== undefined && s.away !== undefined; });
                    reply.send({
                        success: true,
                        data: {
                            match_id: match_id_4,
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
                    return [2 /*return*/];
                }
                return [4 /*yield*/, liveMatchCache_service_1.liveMatchCache.get(match_id_4)];
            case 10:
                cachedLiveDetail = _c.sent();
                if (cachedLiveDetail) {
                    logger_1.logger.debug("[MatchController] Returning cached live detail for ".concat(match_id_4));
                    reply.send({
                        success: true,
                        data: cachedLiveDetail,
                    });
                    return [2 /*return*/];
                }
                logger_1.logger.info("[MatchController] Live cache miss for ".concat(match_id_4, ", fetching from API (status: ").concat(matchStatus, ")"));
                result = null;
                _c.label = 11;
            case 11:
                _c.trys.push([11, 14, , 15]);
                apiUrl = "https://api.thesports.com/v1/football/match/detail_live?user=".concat(process.env.THESPORTS_API_USER, "&secret=").concat(process.env.THESPORTS_API_SECRET, "&id=").concat(match_id_4);
                controller_1 = new AbortController();
                timeoutId = setTimeout(function () { return controller_1.abort(); }, 2000);
                return [4 /*yield*/, fetch(apiUrl, { signal: controller_1.signal })];
            case 12:
                response = _c.sent();
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error("HTTP ".concat(response.status));
                }
                return [4 /*yield*/, response.json()];
            case 13:
                liveData = _c.sent();
                matchData = ((_a = liveData === null || liveData === void 0 ? void 0 : liveData.results) === null || _a === void 0 ? void 0 : _a.find(function (r) { return r.id === match_id_4; })) || ((_b = liveData === null || liveData === void 0 ? void 0 : liveData.results) === null || _b === void 0 ? void 0 : _b[0]);
                if (matchData) {
                    STAT_NAMES_1 = {
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
                    allStats = (matchData.stats || []).map(function (s) {
                        var _a, _b;
                        return ({
                            type: s.type,
                            home: s.home,
                            away: s.away,
                            name: ((_a = STAT_NAMES_1[s.type]) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                            nameTr: ((_b = STAT_NAMES_1[s.type]) === null || _b === void 0 ? void 0 : _b.nameTr) || '',
                        });
                    });
                    incidents = matchData.incidents || [];
                    score = matchData.score || null;
                    result = {
                        match_id: match_id_4,
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
                return [3 /*break*/, 15];
            case 14:
                err_3 = _c.sent();
                logger_1.logger.error("[MatchController] Failed to fetch live stats for ".concat(match_id_4, ": ").concat(err_3.message));
                return [3 /*break*/, 15];
            case 15:
                if (result) {
                    reply.send({
                        success: true,
                        data: result,
                    });
                    return [2 /*return*/];
                }
                // Fallback: If API failed, create empty result structure
                logger_1.logger.warn("[MatchController] No live data available for ".concat(match_id_4, ", using empty fallback"));
                result = {
                    matchId: match_id_4,
                    match_status: matchStatus,
                    allStats: [],
                    basicStats: [],
                    detailedStats: [],
                    incidents: [],
                    score: null,
                    halfTimeStats: null,
                };
                if (!(isHalfTime && result && result.allStats.length > 0 && !firstHalfStats)) return [3 /*break*/, 17];
                logger_1.logger.info("[MatchController] \u26BD HALF_TIME detected! Saving first half stats for ".concat(match_id_4));
                return [4 /*yield*/, combinedStatsService.saveFirstHalfStats(match_id_4, result.allStats)];
            case 16:
                _c.sent();
                firstHalfStats = result.allStats;
                _c.label = 17;
            case 17:
                // Save to database (CRITICAL for persistence after match ends)
                if (result && result.allStats.length > 0) {
                    combinedStatsService.saveCombinedStatsToDatabase(match_id_4, result).catch(function (err) {
                        logger_1.logger.error("[MatchController] Failed to save stats to DB for ".concat(match_id_4, ":"), err);
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
                return [3 /*break*/, 19];
            case 18:
                error_17 = _c.sent();
                logger_1.logger.error('[MatchController] Error in getMatchLiveStats:', error_17);
                reply.status(500).send({
                    success: false,
                    message: error_17.message || 'Internal server error',
                });
                return [3 /*break*/, 19];
            case 19: return [2 /*return*/];
        }
    });
}); };
exports.getMatchLiveStats = getMatchLiveStats;
/**
 * Trigger pre-sync for today's matches
 * POST /api/admin/pre-sync
 * Syncs H2H, lineups, standings, and compensation data
 */
var triggerPreSync = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var DailyPreSyncService, preSyncService, today, dbResult, matches, matchIds, seasonIds, result, error_18;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../services/thesports/sync/dailyPreSync.service')); })];
            case 1:
                DailyPreSyncService = (_a.sent()).DailyPreSyncService;
                preSyncService = new DailyPreSyncService();
                today = new Date().toISOString().split('T')[0];
                return [4 /*yield*/, matchDatabaseService.getMatchesByDate(today)];
            case 2:
                dbResult = _a.sent();
                matches = dbResult.results || [];
                matchIds = matches.map(function (m) { return m.external_id || m.id; }).filter(Boolean);
                seasonIds = matches.map(function (m) { return m.season_id; }).filter(Boolean);
                logger_1.logger.info("Triggering pre-sync for ".concat(matchIds.length, " matches, ").concat(seasonIds.length, " seasons"));
                return [4 /*yield*/, preSyncService.runPreSync(matchIds, seasonIds)];
            case 3:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result,
                });
                return [3 /*break*/, 5];
            case 4:
                error_18 = _a.sent();
                logger_1.logger.error('[MatchController] Error in triggerPreSync:', error_18);
                reply.status(500).send({
                    success: false,
                    message: error_18.message || 'Internal server error',
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.triggerPreSync = triggerPreSync;
/**
 * Get H2H data (reads from database first, then API fallback)
 * GET /api/matches/:match_id/h2h
 */
var getMatchH2H = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, DailyPreSyncService, preSyncService, h2hData, pool_3, client, matchStatus, statusResult, syncResult, syncError_2, error_19;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 16, , 17]);
                match_id = request.params.match_id;
                logger_1.logger.info("[getMatchH2H] \u26A1 ENDPOINT CALLED for match ".concat(match_id));
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../services/thesports/sync/dailyPreSync.service')); })];
            case 1:
                DailyPreSyncService = (_a.sent()).DailyPreSyncService;
                preSyncService = new DailyPreSyncService();
                return [4 /*yield*/, preSyncService.getH2HFromDb(match_id)];
            case 2:
                h2hData = _a.sent();
                logger_1.logger.info("[getMatchH2H] Database query result for ".concat(match_id, ": ").concat(h2hData ? 'FOUND' : 'NOT FOUND'));
                if (!!h2hData) return [3 /*break*/, 15];
                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('../database/connection')); })];
            case 3:
                pool_3 = (_a.sent()).pool;
                return [4 /*yield*/, pool_3.connect()];
            case 4:
                client = _a.sent();
                matchStatus = null;
                _a.label = 5;
            case 5:
                _a.trys.push([5, , 7, 8]);
                return [4 /*yield*/, client.query('SELECT status_id FROM ts_matches WHERE external_id = $1', [match_id])];
            case 6:
                statusResult = _a.sent();
                if (statusResult.rows.length > 0) {
                    matchStatus = statusResult.rows[0].status_id;
                }
                return [3 /*break*/, 8];
            case 7:
                client.release();
                return [7 /*endfinally*/];
            case 8:
                if (!(matchStatus === 1)) return [3 /*break*/, 14];
                logger_1.logger.info("[getMatchH2H] H2H not in DB for ".concat(match_id, " (status=NOT_STARTED), fetching from API"));
                _a.label = 9;
            case 9:
                _a.trys.push([9, 12, , 13]);
                return [4 /*yield*/, preSyncService.syncH2HToDb(match_id)];
            case 10:
                syncResult = _a.sent();
                logger_1.logger.info("[getMatchH2H] syncH2HToDb result for ".concat(match_id, ": ").concat(syncResult));
                return [4 /*yield*/, preSyncService.getH2HFromDb(match_id)];
            case 11:
                h2hData = _a.sent();
                logger_1.logger.info("[getMatchH2H] After sync, h2hData from DB: ".concat(h2hData ? 'found' : 'not found'));
                return [3 /*break*/, 13];
            case 12:
                syncError_2 = _a.sent();
                logger_1.logger.error("[getMatchH2H] Failed to sync H2H for ".concat(match_id, ": ").concat(syncError_2.message), syncError_2);
                return [3 /*break*/, 13];
            case 13: return [3 /*break*/, 15];
            case 14:
                logger_1.logger.info("[getMatchH2H] Match ".concat(match_id, " has status ").concat(matchStatus, " (not NOT_STARTED). API /match/analysis only works for NOT_STARTED matches. Skipping API call."));
                _a.label = 15;
            case 15:
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
                return [3 /*break*/, 17];
            case 16:
                error_19 = _a.sent();
                logger_1.logger.error('[MatchController] Error in getMatchH2H:', error_19);
                reply.status(500).send({
                    success: false,
                    message: error_19.message || 'Internal server error',
                });
                return [3 /*break*/, 17];
            case 17: return [2 /*return*/];
        }
    });
}); };
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
var getUnifiedMatches = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, date, include_live, include_ai, status_1, TSI_OFFSET_MS, nowTSI, todayStr, dateStr, includeLive, includeAI, statusFilter_1, cached, normalizeMatch, diaryResult, diaryMatches, diaryMatchIds_1, crossDayLiveMatches, liveResult, allLiveMatches, mergedMatches, finalMatches, aiPredictionsCount, response, error_20;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                _a = request.query, date = _a.date, include_live = _a.include_live, include_ai = _a.include_ai, status_1 = _a.status;
                TSI_OFFSET_MS = 3 * 60 * 60 * 1000;
                nowTSI = new Date(Date.now() + TSI_OFFSET_MS);
                todayStr = nowTSI.toISOString().split('T')[0].replace(/-/g, '');
                dateStr = (date === null || date === void 0 ? void 0 : date.replace(/-/g, '')) || todayStr;
                if (!/^\d{8}$/.test(dateStr)) {
                    return [2 /*return*/, reply.status(400).send({
                            success: false,
                            message: 'Invalid date format. Expected YYYY-MM-DD or YYYYMMDD',
                        })];
                }
                includeLive = include_live !== 'false';
                includeAI = include_ai !== 'false';
                if (status_1) {
                    statusFilter_1 = status_1.split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n); });
                }
                cached = liveMatchCache_service_1.liveMatchCache.getUnified(dateStr, includeLive);
                if (cached && !statusFilter_1 && !includeAI) { // Don't use cache if status filter or AI is requested
                    logger_1.logger.debug("[MatchController] Unified cache HIT for ".concat(dateStr));
                    // Add browser cache headers (30s cache with 60s stale-while-revalidate)
                    reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
                    reply.header('X-Cache', 'HIT');
                    return [2 /*return*/, reply.send({
                            success: true,
                            data: {
                                results: cached.results,
                                date: dateStr,
                                includeLive: includeLive,
                                source: 'cache',
                                cacheStats: liveMatchCache_service_1.liveMatchCache.getStats(),
                            },
                        })];
                }
                logger_1.logger.info("[MatchController] Unified fetch for date=".concat(dateStr, ", includeLive=").concat(includeLive, ", includeAI=").concat(includeAI));
                normalizeMatch = function (row) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
                    var statusId = (_b = (_a = row.status_id) !== null && _a !== void 0 ? _a : row.status) !== null && _b !== void 0 ? _b : 1;
                    var minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
                    var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
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
                        home_score: (_c = row.home_score) !== null && _c !== void 0 ? _c : 0,
                        away_score: (_d = row.away_score) !== null && _d !== void 0 ? _d : 0,
                        home_score_overtime: (_e = row.home_score_overtime) !== null && _e !== void 0 ? _e : 0,
                        away_score_overtime: (_f = row.away_score_overtime) !== null && _f !== void 0 ? _f : 0,
                        home_score_penalties: (_g = row.home_score_penalties) !== null && _g !== void 0 ? _g : 0,
                        away_score_penalties: (_h = row.away_score_penalties) !== null && _h !== void 0 ? _h : 0,
                        home_red_cards: (_j = row.home_red_cards) !== null && _j !== void 0 ? _j : 0,
                        away_red_cards: (_k = row.away_red_cards) !== null && _k !== void 0 ? _k : 0,
                        home_yellow_cards: (_l = row.home_yellow_cards) !== null && _l !== void 0 ? _l : 0,
                        away_yellow_cards: (_m = row.away_yellow_cards) !== null && _m !== void 0 ? _m : 0,
                        home_corners: (_o = row.home_corners) !== null && _o !== void 0 ? _o : 0,
                        away_corners: (_p = row.away_corners) !== null && _p !== void 0 ? _p : 0,
                        live_kickoff_time: (_r = (_q = row.live_kickoff_time) !== null && _q !== void 0 ? _q : row.match_time) !== null && _r !== void 0 ? _r : null,
                        home_team: row.home_team || null,
                        away_team: row.away_team || null,
                        competition: row.competition || null,
                        home_team_name: row.home_team_name || ((_s = row.home_team) === null || _s === void 0 ? void 0 : _s.name) || null,
                        away_team_name: row.away_team_name || ((_t = row.away_team) === null || _t === void 0 ? void 0 : _t.name) || null,
                    };
                };
                return [4 /*yield*/, matchDatabaseService.getMatchesByDate(dateStr, statusFilter_1, includeAI)];
            case 1:
                diaryResult = _b.sent();
                diaryMatches = (diaryResult.results || []).map(normalizeMatch);
                diaryMatchIds_1 = new Set(diaryMatches.map(function (m) { return m.id; }));
                logger_1.logger.debug("[MatchController] Diary: ".concat(diaryMatches.length, " matches for ").concat(dateStr));
                crossDayLiveMatches = [];
                if (!includeLive) return [3 /*break*/, 3];
                return [4 /*yield*/, matchDatabaseService.getLiveMatches(includeAI)];
            case 2:
                liveResult = _b.sent();
                allLiveMatches = (liveResult.results || []).map(normalizeMatch);
                // Only include live matches NOT in diary (cross-day matches)
                crossDayLiveMatches = allLiveMatches.filter(function (m) { return !diaryMatchIds_1.has(m.id); });
                logger_1.logger.debug("[MatchController] Cross-day live: ".concat(crossDayLiveMatches.length, " matches"));
                _b.label = 3;
            case 3:
                mergedMatches = __spreadArray(__spreadArray([], diaryMatches, true), crossDayLiveMatches, true);
                finalMatches = mergedMatches;
                if (statusFilter_1 && statusFilter_1.length > 0) {
                    finalMatches = mergedMatches.filter(function (m) { return statusFilter_1.includes(m.status_id); });
                }
                aiPredictionsCount = includeAI
                    ? finalMatches.filter(function (m) { return m.aiPrediction !== undefined; }).length
                    : undefined;
                response = {
                    results: finalMatches,
                };
                // Cache the result (only if no status filter and no AI requested)
                if (!statusFilter_1 && !includeAI) {
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
                        includeLive: includeLive,
                        counts: __assign({ total: finalMatches.length, diary: diaryMatches.length, crossDayLive: crossDayLiveMatches.length, live: finalMatches.filter(function (m) { return [2, 3, 4, 5, 7].includes(m.status_id); }).length, finished: finalMatches.filter(function (m) { return m.status_id === 8; }).length, notStarted: finalMatches.filter(function (m) { return m.status_id === 1; }).length }, (aiPredictionsCount !== undefined ? { aiPredictions: aiPredictionsCount } : {})),
                        source: 'database',
                        cacheStats: liveMatchCache_service_1.liveMatchCache.getStats(),
                    },
                });
                return [3 /*break*/, 5];
            case 4:
                error_20 = _b.sent();
                logger_1.logger.error('[MatchController] Error in getUnifiedMatches:', error_20);
                reply.status(500).send({
                    success: false,
                    message: error_20.message || 'Internal server error',
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
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
var getMatchIncidents = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var match_id, result, error_21;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                match_id = request.params.match_id;
                if (!match_id) {
                    reply.status(400).send({
                        success: false,
                        error: 'match_id parameter is required'
                    });
                    return [2 /*return*/];
                }
                logger_1.logger.info("[getMatchIncidents] Fetching incidents for match: ".concat(match_id));
                return [4 /*yield*/, matchIncidents_service_1.matchIncidentsService.getMatchIncidents(match_id)];
            case 1:
                result = _a.sent();
                reply.send({
                    success: true,
                    data: result
                });
                return [3 /*break*/, 3];
            case 2:
                error_21 = _a.sent();
                logger_1.logger.error('[getMatchIncidents] Error:', error_21);
                reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch match incidents'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
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
var getMatchFull = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var startTime, match_id, cacheKey, cached, duration, globalTimeout, fetchAllData, result, standings, standingsResult, _a, responseData, statusId, duration, error_22, duration;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                startTime = Date.now();
                match_id = request.params.match_id;
                if (!match_id) {
                    reply.status(400).send({
                        success: false,
                        error: 'match_id parameter is required'
                    });
                    return [2 /*return*/];
                }
                cacheKey = memoryCache_1.cacheKeys.matchFull(match_id);
                cached = memoryCache_1.memoryCache.get('matchFull', cacheKey);
                if (cached) {
                    duration = Date.now() - startTime;
                    logger_1.logger.debug("[getMatchFull] CACHE HIT for ".concat(match_id, " (").concat(duration, "ms)"));
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
                    return [2 /*return*/];
                }
                // ============================================================
                // CACHE MISS - Fetch from database
                // ============================================================
                logger_1.logger.info("[getMatchFull] CACHE MISS for ".concat(match_id, ", fetching from DB"));
                _c.label = 1;
            case 1:
                _c.trys.push([1, 7, , 8]);
                globalTimeout = new Promise(function (_, reject) {
                    return setTimeout(function () { return reject(new Error('Global timeout')); }, 3000);
                });
                fetchAllData = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, matchResult, statsResult, incidentsResult, lineupResult, h2hResult, trendResult;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, Promise.all([
                                    // Match basic info (DB only - fast)
                                    getMatchFromDb(match_id).catch(function (err) {
                                        logger_1.logger.error("[getMatchFull] Match fetch failed for ".concat(match_id, ":"), err.message);
                                        return null;
                                    }),
                                    // Stats - use existing service with 1s individual timeout
                                    fetchStatsWithTimeout(match_id, 1000).catch(function () { return ({ stats: [] }); }),
                                    // Incidents - use existing service with 1s individual timeout
                                    matchIncidents_service_1.matchIncidentsService.getMatchIncidents(match_id)
                                        .then(function (r) { return r.incidents || []; })
                                        .catch(function () { return []; }),
                                    // Lineup - use existing service with 1s individual timeout
                                    getLineupFromDb(match_id).catch(function () { return null; }),
                                    // H2H - use existing service (DB only - fast)
                                    getH2HFromDb(match_id).catch(function () { return null; }),
                                    // Trend - use existing service with 1s individual timeout
                                    getTrendFromDb(match_id).catch(function () { return []; }),
                                ])];
                            case 1:
                                _a = _b.sent(), matchResult = _a[0], statsResult = _a[1], incidentsResult = _a[2], lineupResult = _a[3], h2hResult = _a[4], trendResult = _a[5];
                                // Build response object
                                return [2 /*return*/, {
                                        match: matchResult,
                                        stats: (statsResult === null || statsResult === void 0 ? void 0 : statsResult.stats) || [],
                                        incidents: incidentsResult || [],
                                        lineup: lineupResult,
                                        h2h: h2hResult,
                                        trend: trendResult || [],
                                    }];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.race([fetchAllData(), globalTimeout])];
            case 2:
                result = _c.sent();
                standings = [];
                if (!((_b = result.match) === null || _b === void 0 ? void 0 : _b.season_id)) return [3 /*break*/, 6];
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, seasonStandingsService.getSeasonStandings({ season_id: result.match.season_id })];
            case 4:
                standingsResult = _c.sent();
                standings = (standingsResult.results || []);
                return [3 /*break*/, 6];
            case 5:
                _a = _c.sent();
                return [3 /*break*/, 6];
            case 6:
                responseData = __assign(__assign({}, result), { standings: standings });
                // ============================================================
                // PHASE 5: CACHE THE RESULT (status-aware TTL)
                // ============================================================
                if (result.match) {
                    statusId = result.match.status_id;
                    memoryCache_1.memoryCache.set('matchFull', cacheKey, responseData, statusId);
                    logger_1.logger.debug("[getMatchFull] Cached ".concat(match_id, " with status ").concat(statusId));
                }
                duration = Date.now() - startTime;
                // Log warning if match not found
                if (!result.match) {
                    logger_1.logger.warn("[getMatchFull] Match not found in DB for ".concat(match_id, " (").concat(duration, "ms)"));
                }
                else {
                    logger_1.logger.info("[getMatchFull] Completed in ".concat(duration, "ms for ").concat(match_id, " (source: database)"));
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
                return [3 /*break*/, 8];
            case 7:
                error_22 = _c.sent();
                duration = Date.now() - startTime;
                logger_1.logger.error("[getMatchFull] Error after ".concat(duration, "ms:"), error_22.message);
                // On timeout, return partial data if available
                if (error_22.message === 'Global timeout') {
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
                    return [2 /*return*/];
                }
                reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch match data'
                });
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.getMatchFull = getMatchFull;
// Helper: Fetch stats with individual timeout
// BUGFIX: Now uses combinedStatsService to get BOTH basic AND detailed stats
// This ensures detailed stats (passes, tackles, interceptions) are included
function fetchStatsWithTimeout(matchId, timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        var timeout, statsPromise;
        var _this = this;
        return __generator(this, function (_a) {
            timeout = new Promise(function (_, reject) {
                return setTimeout(function () { return reject(new Error('Stats timeout')); }, timeoutMs);
            });
            statsPromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                var dbCombinedStats, dbStats;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, combinedStatsService.getCombinedStatsFromDatabase(matchId)];
                        case 1:
                            dbCombinedStats = _a.sent();
                            if (dbCombinedStats && dbCombinedStats.allStats.length > 0) {
                                logger_1.logger.debug("[fetchStatsWithTimeout] DB hit for ".concat(matchId, ": ").concat(dbCombinedStats.allStats.length, " stats"));
                                return [2 /*return*/, { stats: dbCombinedStats.allStats }];
                            }
                            return [4 /*yield*/, matchStats_repository_1.matchStatsRepository.getStats(matchId)];
                        case 2:
                            dbStats = _a.sent();
                            if (dbStats && (dbStats.home_corner !== 0 || dbStats.away_corner !== 0 ||
                                dbStats.home_shots !== 0 || dbStats.away_shots !== 0)) {
                                return [2 /*return*/, {
                                        stats: [
                                            { type: 25, home: dbStats.home_possession || 0, away: dbStats.away_possession || 0, name: 'Ball Possession', nameTr: 'Top Hakimiyeti' },
                                            { type: 21, home: dbStats.home_shots_on_target || 0, away: dbStats.away_shots_on_target || 0, name: 'Shots on Target', nameTr: 'İsabetli Şut' },
                                            { type: 22, home: (dbStats.home_shots || 0) - (dbStats.home_shots_on_target || 0), away: (dbStats.away_shots || 0) - (dbStats.away_shots_on_target || 0), name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
                                            { type: 23, home: dbStats.home_attacks || 0, away: dbStats.away_attacks || 0, name: 'Attacks', nameTr: 'Atak' },
                                            { type: 24, home: dbStats.home_dangerous_attacks || 0, away: dbStats.away_dangerous_attacks || 0, name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
                                            { type: 2, home: dbStats.home_corner || 0, away: dbStats.away_corner || 0, name: 'Corner Kicks', nameTr: 'Korner' },
                                            { type: 3, home: dbStats.home_yellow_cards || 0, away: dbStats.away_yellow_cards || 0, name: 'Yellow Cards', nameTr: 'Sarı Kart' },
                                            { type: 4, home: dbStats.home_red_cards || 0, away: dbStats.away_red_cards || 0, name: 'Red Cards', nameTr: 'Kırmızı Kart' },
                                        ].filter(function (s) { return s.home !== undefined && s.away !== undefined; })
                                    }];
                            }
                            return [2 /*return*/, { stats: [] }];
                    }
                });
            }); })();
            return [2 /*return*/, Promise.race([statsPromise, timeout])];
        });
    });
}
// Helper: Get match from database
function getMatchFromDb(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var result, row, minuteText, error_23;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT\n        m.external_id as id,\n        m.home_team_id,\n        m.away_team_id,\n        m.competition_id,\n        m.season_id,\n        m.match_time,\n        m.status_id,\n        m.minute,\n        m.incidents,\n        -- CRITICAL FIX: Use COALESCE to get score from multiple sources (same as getMatchById)\n        COALESCE(\n          m.home_score_display,\n          (m.home_scores->0)::INTEGER,\n          m.home_score_regular,\n          0\n        ) as home_score,\n        COALESCE(\n          m.away_score_display,\n          (m.away_scores->0)::INTEGER,\n          m.away_score_regular,\n          0\n        ) as away_score,\n        COALESCE(m.home_score_overtime, 0) as home_score_overtime,\n        COALESCE(m.away_score_overtime, 0) as away_score_overtime,\n        COALESCE(m.home_score_penalties, 0) as home_score_penalties,\n        COALESCE(m.away_score_penalties, 0) as away_score_penalties,\n        COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,\n        COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,\n        COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,\n        COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,\n        COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,\n        COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,\n        -- CRITICAL FIX: Column is logo_url not logo\n        ht.name as home_team_name,\n        ht.logo_url as home_team_logo,\n        at.name as away_team_name,\n        at.logo_url as away_team_logo,\n        c.name as competition_name,\n        c.logo_url as competition_logo,\n        c.country_id\n      FROM ts_matches m\n      LEFT JOIN ts_teams ht ON ht.external_id = m.home_team_id\n      LEFT JOIN ts_teams at ON at.external_id = m.away_team_id\n      LEFT JOIN ts_competitions c ON c.external_id = m.competition_id\n      WHERE m.external_id = $1\n    ", [matchId])];
                case 1:
                    result = _a.sent();
                    if (result.rows.length === 0) {
                        logger_1.logger.warn("[getMatchFromDb] Match not found in DB: ".concat(matchId));
                        return [2 /*return*/, null];
                    }
                    row = result.rows[0];
                    minuteText = (0, matchMinuteText_1.generateMinuteText)(row.minute, row.status_id);
                    return [2 /*return*/, {
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
                        }];
                case 2:
                    error_23 = _a.sent();
                    logger_1.logger.error("[getMatchFromDb] Error fetching match ".concat(matchId, ":"), error_23.message);
                    throw error_23; // Re-throw so caller can handle
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Helper: Get lineup from database
function getLineupFromDb(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var result, row;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, connection_1.pool.query("\n    SELECT lineup_data, home_formation, away_formation\n    FROM ts_matches\n    WHERE external_id = $1\n  ", [matchId])];
                case 1:
                    result = _c.sent();
                    if (result.rows.length === 0 || !result.rows[0].lineup_data)
                        return [2 /*return*/, null];
                    row = result.rows[0];
                    return [2 /*return*/, {
                            home: ((_a = row.lineup_data) === null || _a === void 0 ? void 0 : _a.home) || [],
                            away: ((_b = row.lineup_data) === null || _b === void 0 ? void 0 : _b.away) || [],
                            home_formation: row.home_formation,
                            away_formation: row.away_formation,
                        }];
            }
        });
    });
}
// Helper: Get H2H from database
function getH2HFromDb(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connection_1.pool.query("\n    SELECT h2h_data\n    FROM ts_matches\n    WHERE external_id = $1\n  ", [matchId])];
                case 1:
                    result = _a.sent();
                    if (result.rows.length === 0 || !result.rows[0].h2h_data)
                        return [2 /*return*/, null];
                    return [2 /*return*/, result.rows[0].h2h_data];
            }
        });
    });
}
// Helper: Get trend from database
function getTrendFromDb(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connection_1.pool.query("\n    SELECT trend_data\n    FROM ts_matches\n    WHERE external_id = $1\n  ", [matchId])];
                case 1:
                    result = _a.sent();
                    if (result.rows.length === 0 || !result.rows[0].trend_data)
                        return [2 /*return*/, []];
                    return [2 /*return*/, result.rows[0].trend_data || []];
            }
        });
    });
}

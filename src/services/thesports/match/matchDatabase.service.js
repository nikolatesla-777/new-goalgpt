"use strict";
/**
 * Match Database Service
 *
 * Queries matches directly from the database (ts_matches table)
 * This is used for the frontend to display matches without hitting the API
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchDatabaseService = void 0;
var connection_1 = require("../../../database/connection");
var logger_1 = require("../../../utils/logger");
var matchRecent_service_1 = require("./matchRecent.service");
var matchMinuteText_1 = require("../../../utils/matchMinuteText");
var liveMatchCache_service_1 = require("./liveMatchCache.service");
var MatchState_enum_1 = require("../../../types/thesports/enums/MatchState.enum");
var MatchDatabaseService = /** @class */ (function () {
    function MatchDatabaseService() {
        // SINGLETON: Use shared API client with global rate limiting
        this.matchRecentService = new matchRecent_service_1.MatchRecentService();
    }
    /**
     * Get matches from database for a specific date
     * Date format: YYYY-MM-DD or YYYYMMDD
     * @param statusFilter Optional array of status IDs to filter (e.g., [8] for finished, [1] for not started)
     * @param includeAI Optional flag to include AI predictions (default: false for backward compatibility)
     */
    MatchDatabaseService.prototype.getMatchesByDate = function (date_1, statusFilter_1) {
        return __awaiter(this, arguments, void 0, function (date, statusFilter, includeAI) {
            var dateStr, year, month, day, TSI_OFFSET_SECONDS, startOfDayUTC, endOfDayUTC, startUnix, endUnix, query, params, result, matches, transformedMatches, error_1;
            if (includeAI === void 0) { includeAI = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        dateStr = date.replace(/-/g, '');
                        if (!/^\d{8}$/.test(dateStr)) {
                            logger_1.logger.error("Invalid date format: ".concat(date, ". Expected YYYYMMDD or YYYY-MM-DD"));
                            return [2 /*return*/, { results: [], err: 'Invalid date format' }];
                        }
                        year = parseInt(dateStr.substring(0, 4));
                        month = parseInt(dateStr.substring(4, 6)) - 1;
                        day = parseInt(dateStr.substring(6, 8));
                        TSI_OFFSET_SECONDS = 3 * 3600;
                        startOfDayUTC = new Date(Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000);
                        endOfDayUTC = new Date(Date.UTC(year, month, day, 23, 59, 59) - TSI_OFFSET_SECONDS * 1000);
                        startUnix = Math.floor(startOfDayUTC.getTime() / 1000);
                        endUnix = Math.floor(endOfDayUTC.getTime() / 1000);
                        logger_1.logger.info("\uD83D\uDD0D [MatchDatabase] Querying matches for date ".concat(dateStr, " (").concat(startUnix, " - ").concat(endUnix, ")"));
                        query = "\n        SELECT\n          m.external_id as id,\n          m.competition_id,\n          m.season_id,\n          m.match_time,\n          m.status_id as status_id,\n          m.minute,\n          m.updated_at,\n          m.provider_update_time,\n          m.last_event_ts,\n          m.home_team_id,\n          m.away_team_id,\n          COALESCE(m.home_score_display, 0) as home_score,\n          COALESCE(m.away_score_display, 0) as away_score,\n          m.home_score_overtime,\n          m.away_score_overtime,\n          m.home_score_penalties,\n          m.away_score_penalties,\n          COALESCE(m.home_score_display, 0) as home_score_display,\n          COALESCE(m.away_score_display, 0) as away_score_display,\n          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,\n          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,\n          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,\n          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,\n          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,\n          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,\n          -- CRITICAL: Use live_kickoff_time if available and different from match_time\n          -- If live_kickoff_time is NULL or same as match_time, use match_time (match started on time)\n          -- MQTT updates live_kickoff_time with the REAL kickoff time (Index 4)\n          COALESCE(\n            CASE\n              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time\n              THEN m.live_kickoff_time\n              ELSE m.match_time\n            END,\n            m.match_time\n          ) as live_kickoff_time,\n          -- Home Team\n          ht.name as home_team_name,\n          ht.logo_url as home_team_logo,\n          -- Away Team\n          at.name as away_team_name,\n          at.logo_url as away_team_logo,\n          -- Competition\n          c.name as competition_name,\n          c.logo_url as competition_logo,\n          c.country_id as competition_country_id,\n          -- Country (via competition)\n          co.name as competition_country_name".concat(includeAI ? ",\n          -- AI Prediction (PHASE 1: Latest prediction per match)\n          p.id as ai_id,\n          p.canonical_bot_name,\n          p.prediction,\n          p.prediction_threshold,\n          p.result as ai_result,\n          p.result_reason,\n          p.final_score as ai_final_score,\n          p.access_type,\n          p.minute_at_prediction,\n          p.score_at_prediction,\n          p.created_at as ai_created_at,\n          p.resulted_at" : '', "\n        FROM ts_matches m\n        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n        LEFT JOIN ts_countries co ON c.country_id = co.external_id").concat(includeAI ? "\n        -- PHASE 1: LEFT JOIN LATERAL for latest AI prediction per match\n        LEFT JOIN LATERAL (\n          SELECT id, canonical_bot_name, prediction, prediction_threshold, result,\n                 result_reason, final_score, access_type, minute_at_prediction,\n                 score_at_prediction, created_at, resulted_at\n          FROM ai_predictions\n          WHERE match_id = m.external_id\n          ORDER BY created_at DESC\n          LIMIT 1\n        ) p ON true" : '', "\n        WHERE m.match_time >= $1 AND m.match_time <= $2\n      ");
                        params = [startUnix, endUnix];
                        // CRITICAL FIX: Add status filter if provided
                        if (statusFilter && statusFilter.length > 0) {
                            query += " AND m.status_id = ANY($".concat(params.length + 1, ")");
                            params.push(statusFilter);
                            logger_1.logger.info("\uD83D\uDD0D [MatchDatabase] Filtering by status: ".concat(statusFilter.join(', ')));
                        }
                        query += " ORDER BY m.match_time ASC, c.name ASC";
                        return [4 /*yield*/, connection_1.pool.query(query, params)];
                    case 1:
                        result = _a.sent();
                        matches = result.rows || [];
                        logger_1.logger.info("\u2705 [MatchDatabase] Found ".concat(matches.length, " matches in database for date ").concat(dateStr));
                        transformedMatches = matches.map(function (row) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                            // Status should be authoritative from DB (driven by WS/detail_live/data_update).
                            // Only apply a minimal sanity rule: a future match cannot be END.
                            var validatedStatus = (_a = row.status_id) !== null && _a !== void 0 ? _a : 0;
                            var now = Math.floor(Date.now() / 1000);
                            var matchTime = row.match_time;
                            if (matchTime && matchTime > now) {
                                if (validatedStatus === 8 || validatedStatus === 12) {
                                    validatedStatus = 1; // NOT_STARTED
                                }
                            }
                            // CRITICAL FIX: Generate minute_text from minute and status_id (same as getLiveMatches)
                            var minute = (row.minute !== null && row.minute !== undefined) ? Number(row.minute) : null;
                            var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, validatedStatus);
                            // PHASE 1: Map AI prediction fields if present
                            var aiPrediction = (includeAI && row.ai_id) ? {
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
                            return __assign({ id: row.id, competition_id: row.competition_id, season_id: row.season_id, match_time: row.match_time, status_id: validatedStatus, status: validatedStatus, minute: minute, minute_text: minuteText, home_team_id: row.home_team_id, away_team_id: row.away_team_id, home_score: ((_b = row.home_score) !== null && _b !== void 0 ? _b : null), away_score: ((_c = row.away_score) !== null && _c !== void 0 ? _c : null), home_score_overtime: ((_d = row.home_score_overtime) !== null && _d !== void 0 ? _d : null), away_score_overtime: ((_e = row.away_score_overtime) !== null && _e !== void 0 ? _e : null), home_score_penalties: ((_f = row.home_score_penalties) !== null && _f !== void 0 ? _f : null), away_score_penalties: ((_g = row.away_score_penalties) !== null && _g !== void 0 ? _g : null), home_red_cards: ((_h = row.home_red_cards) !== null && _h !== void 0 ? _h : 0), away_red_cards: ((_j = row.away_red_cards) !== null && _j !== void 0 ? _j : 0), home_yellow_cards: ((_k = row.home_yellow_cards) !== null && _k !== void 0 ? _k : 0), away_yellow_cards: ((_l = row.away_yellow_cards) !== null && _l !== void 0 ? _l : 0), home_corners: ((_m = row.home_corners) !== null && _m !== void 0 ? _m : 0), away_corners: ((_o = row.away_corners) !== null && _o !== void 0 ? _o : 0), live_kickoff_time: ((_q = (_p = row.live_kickoff_time) !== null && _p !== void 0 ? _p : row.match_time) !== null && _q !== void 0 ? _q : null), 
                                // Team data
                                home_team: row.home_team_name ? {
                                    id: row.home_team_id,
                                    name: row.home_team_name,
                                    logo_url: row.home_team_logo || null,
                                } : null, away_team: row.away_team_name ? {
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
                                home_team_name: row.home_team_name || null, away_team_name: row.away_team_name || null }, (aiPrediction ? { aiPrediction: aiPrediction } : {}));
                        });
                        return [2 /*return*/, {
                                results: transformedMatches,
                            }];
                    case 2:
                        error_1 = _a.sent();
                        logger_1.logger.error("\u274C [MatchDatabase] Error querying matches:", error_1);
                        return [2 /*return*/, {
                                results: [],
                                err: error_1.message || 'Database query failed',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
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
    MatchDatabaseService.prototype.getLiveMatches = function () {
        return __awaiter(this, arguments, void 0, function (includeAI) {
            var nowTs, query, result, matches, transformedMatches, response, error_2;
            if (includeAI === void 0) { includeAI = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
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
                        logger_1.logger.info("\uD83D\uDD0D [MatchDatabase] Cache MISS - querying live matches from DATABASE...");
                        nowTs = Math.floor(Date.now() / 1000);
                        query = "\n        SELECT\n          m.external_id as id,\n          m.competition_id,\n          m.season_id,\n          m.match_time,\n          m.status_id as status_id,\n          m.minute,\n          m.updated_at,\n          m.provider_update_time,\n          m.last_event_ts,\n          m.home_team_id,\n          m.away_team_id,\n          COALESCE(m.home_score_display, 0) as home_score,\n          COALESCE(m.away_score_display, 0) as away_score,\n          m.home_score_overtime,\n          m.away_score_overtime,\n          m.home_score_penalties,\n          m.away_score_penalties,\n          COALESCE(m.home_score_display, 0) as home_score_display,\n          COALESCE(m.away_score_display, 0) as away_score_display,\n          COALESCE(\n            CASE\n              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time\n              THEN m.live_kickoff_time\n              ELSE m.match_time\n            END,\n            m.match_time\n          ) as live_kickoff_time,\n          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,\n          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,\n          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,\n          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,\n          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,\n          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,\n          ht.name as home_team_name,\n          ht.logo_url as home_team_logo,\n          at.name as away_team_name,\n          at.logo_url as away_team_logo,\n          c.name as competition_name,\n          c.logo_url as competition_logo,\n          c.country_id as competition_country_id,\n          co.name as competition_country_name".concat(includeAI ? ",\n          -- AI Prediction (PHASE 1: Latest prediction per match)\n          p.id as ai_id,\n          p.canonical_bot_name,\n          p.prediction,\n          p.prediction_threshold,\n          p.result as ai_result,\n          p.result_reason,\n          p.final_score as ai_final_score,\n          p.access_type,\n          p.minute_at_prediction,\n          p.score_at_prediction,\n          p.created_at as ai_created_at,\n          p.resulted_at" : '', "\n        FROM ts_matches m\n        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n        LEFT JOIN ts_countries co ON c.country_id = co.external_id").concat(includeAI ? "\n        -- PHASE 1: LEFT JOIN LATERAL for latest AI prediction per match\n        LEFT JOIN LATERAL (\n          SELECT id, canonical_bot_name, prediction, prediction_threshold, result,\n                 result_reason, final_score, access_type, minute_at_prediction,\n                 score_at_prediction, created_at, resulted_at\n          FROM ai_predictions\n          WHERE match_id = m.external_id\n          ORDER BY created_at DESC\n          LIMIT 1\n        ) p ON true" : '', "\n        WHERE m.status_id IN (").concat(MatchState_enum_1.LIVE_STATUSES_SQL, ")  -- CRITICAL: ONLY strictly live matches (no finished/interrupted)\n          AND m.match_time <= $1  -- CRITICAL: Exclude future matches (safeguard)\n        ORDER BY\n          -- Live matches first (by minute descending), then by competition name\n          CASE WHEN m.status_id IN (").concat(MatchState_enum_1.LIVE_STATUSES_SQL, ") THEN COALESCE(m.minute, 0) ELSE 0 END DESC,\n          c.name ASC,\n          m.match_time DESC\n      ");
                        return [4 /*yield*/, connection_1.pool.query(query, [nowTs])];
                    case 1:
                        result = _a.sent();
                        matches = result.rows || [];
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/1eefcedf-7c6a-4338-ae7b-79041647f89f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'matchDatabase.service.ts:274', message: 'getLiveMatches query result', data: { matchCount: matches.length, queryDuration: Date.now() }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        logger_1.logger.info("\u2705 [MatchDatabase] Found ".concat(matches.length, " strictly live matches in database (status_id IN 2,3,4,5,7, NO TIME WINDOW)"));
                        transformedMatches = matches.map(function (row) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                            var validatedStatus = (_a = row.status_id) !== null && _a !== void 0 ? _a : 0;
                            var now = Math.floor(Date.now() / 1000);
                            var matchTime = row.match_time;
                            // Sanity check: future matches cannot be END
                            if (matchTime && matchTime > now) {
                                if (validatedStatus === 8 || validatedStatus === 12) {
                                    validatedStatus = 1; // NOT_STARTED
                                }
                            }
                            // CRITICAL FIX: Generate minute_text from minute and status_id
                            var minute = (row.minute !== null && row.minute !== undefined) ? Number(row.minute) : null;
                            var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, validatedStatus);
                            // PHASE 1: Map AI prediction fields if present
                            var aiPrediction = (includeAI && row.ai_id) ? {
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
                            return __assign({ id: row.id, competition_id: row.competition_id, season_id: row.season_id, match_time: row.match_time, status_id: validatedStatus, status: validatedStatus, minute: minute, minute_text: minuteText, home_team_id: row.home_team_id, away_team_id: row.away_team_id, home_score: ((_b = row.home_score) !== null && _b !== void 0 ? _b : null), away_score: ((_c = row.away_score) !== null && _c !== void 0 ? _c : null), home_score_overtime: ((_d = row.home_score_overtime) !== null && _d !== void 0 ? _d : null), away_score_overtime: ((_e = row.away_score_overtime) !== null && _e !== void 0 ? _e : null), home_score_penalties: ((_f = row.home_score_penalties) !== null && _f !== void 0 ? _f : null), away_score_penalties: ((_g = row.away_score_penalties) !== null && _g !== void 0 ? _g : null), home_red_cards: ((_h = row.home_red_cards) !== null && _h !== void 0 ? _h : 0), away_red_cards: ((_j = row.away_red_cards) !== null && _j !== void 0 ? _j : 0), home_yellow_cards: ((_k = row.home_yellow_cards) !== null && _k !== void 0 ? _k : 0), away_yellow_cards: ((_l = row.away_yellow_cards) !== null && _l !== void 0 ? _l : 0), home_corners: ((_m = row.home_corners) !== null && _m !== void 0 ? _m : 0), away_corners: ((_o = row.away_corners) !== null && _o !== void 0 ? _o : 0), live_kickoff_time: ((_q = (_p = row.live_kickoff_time) !== null && _p !== void 0 ? _p : row.match_time) !== null && _q !== void 0 ? _q : null), home_team: row.home_team_name ? {
                                    id: row.home_team_id,
                                    name: row.home_team_name,
                                    logo_url: row.home_team_logo || null,
                                } : null, away_team: row.away_team_name ? {
                                    id: row.away_team_id,
                                    name: row.away_team_name,
                                    logo_url: row.away_team_logo || null,
                                } : null, competition: row.competition_name ? {
                                    id: row.competition_id,
                                    name: row.competition_name,
                                    logo_url: row.competition_logo || null,
                                    country_id: row.competition_country_id || null,
                                    country_name: row.competition_country_name || null,
                                } : null, home_team_name: row.home_team_name || null, away_team_name: row.away_team_name || null }, (aiPrediction ? { aiPrediction: aiPrediction } : {}));
                        });
                        response = {
                            results: transformedMatches,
                        };
                        // Phase 6: Smart Cache - Store in cache with short TTL (event-driven invalidation)
                        liveMatchCache_service_1.liveMatchCache.setLiveMatches(response);
                        logger_1.logger.debug("[MatchDatabase] Cache SET - ".concat(transformedMatches.length, " live matches"));
                        return [2 /*return*/, response];
                    case 2:
                        error_2 = _a.sent();
                        logger_1.logger.error("\u274C [MatchDatabase] Error querying live matches from database:", error_2);
                        return [2 /*return*/, {
                                results: [],
                                err: error_2.message || 'Database query failed',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
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
    MatchDatabaseService.prototype.getShouldBeLiveMatches = function () {
        return __awaiter(this, arguments, void 0, function (maxMinutesAgo, limit) {
            var safeMaxMinutesAgo, safeLimit, now, minTime, TSI_OFFSET_SECONDS, nowDate, year, month, day, todayStart, effectiveMinTime, query, result, matches, transformedMatches, error_3;
            if (maxMinutesAgo === void 0) { maxMinutesAgo = 120; }
            if (limit === void 0) { limit = 200; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        safeMaxMinutesAgo = Math.min(Math.max(1, maxMinutesAgo), 1440);
                        safeLimit = Math.min(Math.max(1, limit), 500);
                        now = Math.floor(Date.now() / 1000);
                        minTime = now - (safeMaxMinutesAgo * 60);
                        TSI_OFFSET_SECONDS = 3 * 3600;
                        nowDate = new Date(now * 1000);
                        year = nowDate.getUTCFullYear();
                        month = nowDate.getUTCMonth();
                        day = nowDate.getUTCDate();
                        todayStart = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
                        effectiveMinTime = Math.max(minTime, todayStart);
                        query = "\n        SELECT\n          m.external_id as id,\n          m.competition_id,\n          m.season_id,\n          m.match_time,\n          m.status_id as status_id,\n          m.minute,\n          m.updated_at,\n          m.provider_update_time,\n          m.last_event_ts,\n          m.home_team_id,\n          m.away_team_id,\n          COALESCE(m.home_score_display, 0) as home_score,\n          COALESCE(m.away_score_display, 0) as away_score,\n          m.home_score_overtime,\n          m.away_score_overtime,\n          m.home_score_penalties,\n          m.away_score_penalties,\n          COALESCE(m.home_score_display, 0) as home_score_display,\n          COALESCE(m.away_score_display, 0) as away_score_display,\n          COALESCE(\n            CASE\n              WHEN m.live_kickoff_time IS NOT NULL AND m.live_kickoff_time != m.match_time\n              THEN m.live_kickoff_time\n              ELSE m.match_time\n            END,\n            m.match_time\n          ) as live_kickoff_time,\n          COALESCE(m.home_red_cards, (m.home_scores->>2)::INTEGER, 0) as home_red_cards,\n          COALESCE(m.away_red_cards, (m.away_scores->>2)::INTEGER, 0) as away_red_cards,\n          COALESCE(m.home_yellow_cards, (m.home_scores->>3)::INTEGER, 0) as home_yellow_cards,\n          COALESCE(m.away_yellow_cards, (m.away_scores->>3)::INTEGER, 0) as away_yellow_cards,\n          COALESCE(m.home_corners, (m.home_scores->>4)::INTEGER, 0) as home_corners,\n          COALESCE(m.away_corners, (m.away_scores->>4)::INTEGER, 0) as away_corners,\n          ht.name as home_team_name,\n          ht.logo_url as home_team_logo,\n          at.name as away_team_name,\n          at.logo_url as away_team_logo,\n          c.name as competition_name,\n          c.logo_url as competition_logo,\n          c.country_id as competition_country_id,\n          co.name as competition_country_name\n        FROM ts_matches m\n        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n        LEFT JOIN ts_countries co ON c.country_id = co.external_id\n        WHERE m.status_id = 1  -- NOT_STARTED\n          AND m.match_time <= $1  -- match_time has passed\n          AND m.match_time >= $2  -- Today's matches (TS\u0130-based) or maxMinutesAgo window\n        ORDER BY m.match_time DESC\n        LIMIT $3\n      ";
                        return [4 /*yield*/, connection_1.pool.query(query, [now, effectiveMinTime, safeLimit])];
                    case 1:
                        result = _a.sent();
                        matches = result.rows || [];
                        logger_1.logger.info("\uD83D\uDD0D [MatchDatabase] Found ".concat(matches.length, " should-be-live matches (status=1, match_time passed, window=").concat(safeMaxMinutesAgo, "m)"));
                        transformedMatches = matches.map(function (row) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                            var statusId = (_a = row.status_id) !== null && _a !== void 0 ? _a : 1;
                            var minute = row.minute !== null && row.minute !== undefined ? Number(row.minute) : null;
                            var minuteText = (0, matchMinuteText_1.generateMinuteText)(minute, statusId);
                            return {
                                id: row.id,
                                competition_id: row.competition_id,
                                season_id: row.season_id,
                                match_time: row.match_time,
                                status_id: statusId,
                                status: statusId,
                                home_team_id: row.home_team_id,
                                away_team_id: row.away_team_id,
                                home_score: ((_b = row.home_score) !== null && _b !== void 0 ? _b : null),
                                away_score: ((_c = row.away_score) !== null && _c !== void 0 ? _c : null),
                                home_score_overtime: ((_d = row.home_score_overtime) !== null && _d !== void 0 ? _d : null),
                                away_score_overtime: ((_e = row.away_score_overtime) !== null && _e !== void 0 ? _e : null),
                                home_score_penalties: ((_f = row.home_score_penalties) !== null && _f !== void 0 ? _f : null),
                                away_score_penalties: ((_g = row.away_score_penalties) !== null && _g !== void 0 ? _g : null),
                                home_red_cards: ((_h = row.home_red_cards) !== null && _h !== void 0 ? _h : 0),
                                away_red_cards: ((_j = row.away_red_cards) !== null && _j !== void 0 ? _j : 0),
                                home_yellow_cards: ((_k = row.home_yellow_cards) !== null && _k !== void 0 ? _k : 0),
                                away_yellow_cards: ((_l = row.away_yellow_cards) !== null && _l !== void 0 ? _l : 0),
                                home_corners: ((_m = row.home_corners) !== null && _m !== void 0 ? _m : 0),
                                away_corners: ((_o = row.away_corners) !== null && _o !== void 0 ? _o : 0),
                                live_kickoff_time: ((_q = (_p = row.live_kickoff_time) !== null && _p !== void 0 ? _p : row.match_time) !== null && _q !== void 0 ? _q : null),
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
                        return [2 /*return*/, {
                                results: transformedMatches,
                            }];
                    case 2:
                        error_3 = _a.sent();
                        logger_1.logger.error("\u274C [MatchDatabase] Error querying should-be-live matches:", error_3);
                        return [2 /*return*/, {
                                results: [],
                                err: error_3.message || 'Database query failed',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return MatchDatabaseService;
}());
exports.MatchDatabaseService = MatchDatabaseService;

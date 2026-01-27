"use strict";
/**
 * Match Sync Service
 *
 * SINGLE SOURCE OF TRUTH for saving matches to database
 * Ensures teams and competitions exist before saving matches
 * Fixes "Unknown League" and Foreign Key issues
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
exports.MatchSyncService = void 0;
var logger_1 = require("../../../utils/logger");
var connection_1 = require("../../../database/connection");
var enums_1 = require("../../../types/thesports/enums");
var CompetitionRepository_1 = require("../../../repositories/implementations/CompetitionRepository");
var TeamRepository_1 = require("../../../repositories/implementations/TeamRepository");
var MatchSyncService = /** @class */ (function () {
    function MatchSyncService(teamDataService, competitionService) {
        // Cached schema capabilities (avoid querying information_schema on every upsert)
        this.matchColumnSupportChecked = false;
        this.hasNewScoreColumns = false;
        this.hasIncidentsColumn = false;
        this.hasStatisticsColumn = false;
        this.hasCompensationColumns = false;
        this.ensuredCompetitionIds = new Set();
        this.ensuredTeamIds = new Set();
        this.teamDataService = teamDataService;
        this.competitionService = competitionService;
        this.competitionRepository = new CompetitionRepository_1.CompetitionRepository();
        this.teamRepository = new TeamRepository_1.TeamRepository();
    }
    /**
     * Save or update a match (atomic upsert)
     * CRITICAL: Ensures teams and competitions exist before saving (seed-on-the-fly)
     * Uses results_extra data if available to prevent foreign key constraint failures
     */
    MatchSyncService.prototype.syncMatch = function (matchData, resultsExtra) {
        return __awaiter(this, void 0, void 0, function () {
            var client, competitionId, homeTeamId_1, awayTeamId_1, competition, compData, homeTeam, teamData, awayTeam, teamData, validatedData, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // RELAXED VALIDATION: Only reject if critical fields are missing
                        if (!matchData.external_id) {
                            throw new Error('REJECTED: missing external_id (required)');
                        }
                        if (matchData.match_time == null || matchData.match_time === 0) {
                            throw new Error('REJECTED: missing match_time (required)');
                        }
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 27, 29, 30]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _a.sent();
                        competitionId = matchData.competition_id != null ? String(matchData.competition_id) : null;
                        homeTeamId_1 = matchData.home_team_id != null ? String(matchData.home_team_id) : null;
                        awayTeamId_1 = matchData.away_team_id != null ? String(matchData.away_team_id) : null;
                        if (!(competitionId && competitionId !== '0' && competitionId !== '')) return [3 /*break*/, 10];
                        if (!!this.ensuredCompetitionIds.has(competitionId)) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.competitionService.getCompetitionById(competitionId)];
                    case 4:
                        competition = _a.sent();
                        if (!(!competition || !competition.name)) return [3 /*break*/, 9];
                        if (!((resultsExtra === null || resultsExtra === void 0 ? void 0 : resultsExtra.competition) && resultsExtra.competition[competitionId])) return [3 /*break*/, 7];
                        compData = resultsExtra.competition[competitionId];
                        logger_1.logger.info("\uD83D\uDD27 Creating competition ".concat(competitionId, " from results_extra: ").concat(compData.name || compData.name_en || 'Unknown'));
                        // Save to DB immediately using repository
                        return [4 /*yield*/, this.competitionRepository.createOrUpdate({
                                external_id: competitionId,
                                name: compData.name || compData.name_en || compData.name_cn || 'Unknown Competition',
                                logo_url: compData.logo_url || compData.logo || null,
                                country_id: compData.country_id || null,
                                category_id: compData.category_id || null,
                                type: compData.type || null,
                            })];
                    case 5:
                        // Save to DB immediately using repository
                        _a.sent();
                        return [4 /*yield*/, this.competitionService.getCompetitionById(competitionId)];
                    case 6:
                        competition = _a.sent();
                        logger_1.logger.info("\u2705 Competition ".concat(competitionId, " created: ").concat((competition === null || competition === void 0 ? void 0 : competition.name) || 'Unknown'));
                        return [3 /*break*/, 9];
                    case 7:
                        // Fallback: Try to fetch from API
                        logger_1.logger.warn("\u26A0\uFE0F Competition ".concat(competitionId, " not in results_extra. Attempting API fetch..."));
                        return [4 /*yield*/, this.competitionService.getCompetitionById(competitionId)];
                    case 8:
                        competition = _a.sent();
                        if (!competition || !competition.name) {
                            logger_1.logger.warn("\u26A0\uFE0F Competition ".concat(competitionId, " still not found. Match will be saved with competition_id but no name."));
                        }
                        _a.label = 9;
                    case 9:
                        this.ensuredCompetitionIds.add(competitionId);
                        _a.label = 10;
                    case 10:
                        if (!(homeTeamId_1 && homeTeamId_1 !== '0' && homeTeamId_1 !== '')) return [3 /*break*/, 17];
                        if (!!this.ensuredTeamIds.has(homeTeamId_1)) return [3 /*break*/, 17];
                        return [4 /*yield*/, this.teamDataService.getTeamById(homeTeamId_1)];
                    case 11:
                        homeTeam = _a.sent();
                        if (!!homeTeam) return [3 /*break*/, 16];
                        teamData = null;
                        // Check if results_extra.team is an array or object
                        if (resultsExtra === null || resultsExtra === void 0 ? void 0 : resultsExtra.team) {
                            if (Array.isArray(resultsExtra.team)) {
                                teamData = resultsExtra.team.find(function (t) { return String(t === null || t === void 0 ? void 0 : t.id) === homeTeamId_1; });
                            }
                            else {
                                teamData = resultsExtra.team[homeTeamId_1];
                            }
                        }
                        if (!teamData) return [3 /*break*/, 14];
                        logger_1.logger.info("\uD83D\uDD27 Creating home team ".concat(homeTeamId_1, " from results_extra: ").concat(teamData.name || 'Unknown'));
                        // Save to DB immediately using repository
                        return [4 /*yield*/, this.teamRepository.createOrUpdate({
                                external_id: homeTeamId_1,
                                name: teamData.name || 'Unknown Team',
                                logo_url: teamData.logo_url || teamData.logo || null,
                                short_name: teamData.short_name || null,
                            })];
                    case 12:
                        // Save to DB immediately using repository
                        _a.sent();
                        return [4 /*yield*/, this.teamDataService.getTeamById(homeTeamId_1)];
                    case 13:
                        homeTeam = _a.sent();
                        logger_1.logger.info("\u2705 Home team ".concat(homeTeamId_1, " created: ").concat((homeTeam === null || homeTeam === void 0 ? void 0 : homeTeam.name) || 'Unknown'));
                        return [3 /*break*/, 16];
                    case 14:
                        // Fallback: Try to fetch from API
                        logger_1.logger.warn("\u26A0\uFE0F Home team ".concat(homeTeamId_1, " not in results_extra. Attempting API fetch..."));
                        return [4 /*yield*/, this.teamDataService.getTeamById(homeTeamId_1)];
                    case 15:
                        homeTeam = _a.sent();
                        if (!homeTeam) {
                            logger_1.logger.warn("\u26A0\uFE0F Home team ".concat(homeTeamId_1, " still not found. Match will be saved with home_team_id but no team data."));
                        }
                        _a.label = 16;
                    case 16:
                        this.ensuredTeamIds.add(homeTeamId_1);
                        _a.label = 17;
                    case 17:
                        if (!(awayTeamId_1 && awayTeamId_1 !== '0' && awayTeamId_1 !== '')) return [3 /*break*/, 24];
                        if (!!this.ensuredTeamIds.has(awayTeamId_1)) return [3 /*break*/, 24];
                        return [4 /*yield*/, this.teamDataService.getTeamById(awayTeamId_1)];
                    case 18:
                        awayTeam = _a.sent();
                        if (!!awayTeam) return [3 /*break*/, 23];
                        teamData = null;
                        // Check if results_extra.team is an array or object
                        if (resultsExtra === null || resultsExtra === void 0 ? void 0 : resultsExtra.team) {
                            if (Array.isArray(resultsExtra.team)) {
                                teamData = resultsExtra.team.find(function (t) { return String(t === null || t === void 0 ? void 0 : t.id) === awayTeamId_1; });
                            }
                            else {
                                teamData = resultsExtra.team[awayTeamId_1];
                            }
                        }
                        if (!teamData) return [3 /*break*/, 21];
                        logger_1.logger.info("\uD83D\uDD27 Creating away team ".concat(awayTeamId_1, " from results_extra: ").concat(teamData.name || 'Unknown'));
                        // Save to DB immediately using repository
                        return [4 /*yield*/, this.teamRepository.createOrUpdate({
                                external_id: awayTeamId_1,
                                name: teamData.name || 'Unknown Team',
                                logo_url: teamData.logo_url || teamData.logo || null,
                                short_name: teamData.short_name || null,
                            })];
                    case 19:
                        // Save to DB immediately using repository
                        _a.sent();
                        return [4 /*yield*/, this.teamDataService.getTeamById(awayTeamId_1)];
                    case 20:
                        awayTeam = _a.sent();
                        logger_1.logger.info("\u2705 Away team ".concat(awayTeamId_1, " created: ").concat((awayTeam === null || awayTeam === void 0 ? void 0 : awayTeam.name) || 'Unknown'));
                        return [3 /*break*/, 23];
                    case 21:
                        // Fallback: Try to fetch from API
                        logger_1.logger.warn("\u26A0\uFE0F Away team ".concat(awayTeamId_1, " not in results_extra. Attempting API fetch..."));
                        return [4 /*yield*/, this.teamDataService.getTeamById(awayTeamId_1)];
                    case 22:
                        awayTeam = _a.sent();
                        if (!awayTeam) {
                            logger_1.logger.warn("\u26A0\uFE0F Away team ".concat(awayTeamId_1, " still not found. Match will be saved with away_team_id but no team data."));
                        }
                        _a.label = 23;
                    case 23:
                        this.ensuredTeamIds.add(awayTeamId_1);
                        _a.label = 24;
                    case 24:
                        validatedData = this.validateMatchData(matchData);
                        // Step 5: Upsert match
                        // Debug: Log first match's JSONB data
                        if (matchData.external_id && matchData.external_id.startsWith('l5ergph4')) {
                            logger_1.logger.debug("\uD83D\uDD0D [MatchSync] Debug match ".concat(matchData.external_id, ":"), {
                                home_scores: matchData.home_scores,
                                away_scores: matchData.away_scores,
                                home_scores_type: typeof matchData.home_scores,
                                away_scores_type: typeof matchData.away_scores,
                                home_scores_is_array: Array.isArray(matchData.home_scores),
                                away_scores_is_array: Array.isArray(matchData.away_scores),
                                incidents: matchData.incidents ? (typeof matchData.incidents) : null,
                                statistics: matchData.statistics ? (typeof matchData.statistics) : null,
                            });
                        }
                        return [4 /*yield*/, this.upsertMatch(client, validatedData)];
                    case 25:
                        _a.sent();
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 26:
                        _a.sent();
                        logger_1.logger.debug("Match ".concat(matchData.external_id, " synced successfully"));
                        return [3 /*break*/, 30];
                    case 27:
                        error_1 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 28:
                        _a.sent();
                        logger_1.logger.error("Failed to sync match ".concat(matchData.external_id, ":"), error_1.message);
                        throw error_1;
                    case 29:
                        client.release();
                        return [7 /*endfinally*/];
                    case 30: return [2 /*return*/];
                }
            });
        });
    };
    MatchSyncService.prototype.ensureMatchColumnSupport = function (client) {
        return __awaiter(this, void 0, void 0, function () {
            var columnCheckQuery, columnCheckResult, cols, scoreCols, compensationCols;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.matchColumnSupportChecked)
                            return [2 /*return*/];
                        columnCheckQuery = "\n      SELECT column_name\n      FROM information_schema.columns\n      WHERE table_name = 'ts_matches' AND column_name IN (\n        'home_score_regular', 'home_score_overtime', 'home_score_penalties', 'home_score_display',\n        'away_score_regular', 'away_score_overtime', 'away_score_penalties', 'away_score_display',\n        'incidents', 'statistics',\n        'home_win_rate', 'away_win_rate', 'draw_rate', 'home_recent_win_rate', 'away_recent_win_rate', 'compensation_data'\n      );\n    ";
                        return [4 /*yield*/, client.query(columnCheckQuery)];
                    case 1:
                        columnCheckResult = _a.sent();
                        cols = new Set(columnCheckResult.rows.map(function (r) { return r.column_name; }));
                        scoreCols = [
                            'home_score_regular', 'home_score_overtime', 'home_score_penalties', 'home_score_display',
                            'away_score_regular', 'away_score_overtime', 'away_score_penalties', 'away_score_display',
                        ];
                        compensationCols = [
                            'home_win_rate', 'away_win_rate', 'draw_rate', 'home_recent_win_rate', 'away_recent_win_rate', 'compensation_data',
                        ];
                        this.hasNewScoreColumns = scoreCols.every(function (c) { return cols.has(c); });
                        this.hasIncidentsColumn = cols.has('incidents');
                        this.hasStatisticsColumn = cols.has('statistics');
                        this.hasCompensationColumns = compensationCols.every(function (c) { return cols.has(c); });
                        this.matchColumnSupportChecked = true;
                        logger_1.logger.info("Match schema detected: hasNewScoreColumns=".concat(this.hasNewScoreColumns, ", ") +
                            "hasIncidents=".concat(this.hasIncidentsColumn, ", hasStatistics=").concat(this.hasStatisticsColumn, ", ") +
                            "hasCompensation=".concat(this.hasCompensationColumns));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate match data and fix timezone issues
     * CRITICAL: If match_time is in the future, status cannot be "Ended" or any finished state
     */
    MatchSyncService.prototype.validateMatchData = function (matchData) {
        var validated = __assign({}, matchData);
        var now = Math.floor(Date.now() / 1000); // Current Unix timestamp (UTC)
        // CRITICAL TIMEZONE FIX: Recalculate status based on match_time vs current time
        if (validated.match_time) {
            var matchTime = validated.match_time;
            var matchDate = new Date(matchTime * 1000);
            var nowDate = new Date(now * 1000);
            var timeDiff = now - matchTime; // Seconds difference
            var minutesDiff = Math.floor(timeDiff / 60);
            // IMPORTANT: Do NOT auto-transition to LIVE based only on time.
            // Live status should be sourced from WebSocket or /match/detail_live confirmation.
            if (matchTime <= now && minutesDiff > 5 && validated.status_id === enums_1.MatchState.NOT_STARTED) {
                logger_1.logger.warn("\u26A0\uFE0F [MatchSync] Match ".concat(validated.external_id, " kickoff passed (").concat(minutesDiff, "m) but status is still NOT_STARTED. ") +
                    "Leaving status as-is (source LIVE from WS/detail_live). Match time: ".concat(matchDate.toISOString(), ", Now: ").concat(nowDate.toISOString()));
            }
            // If match_time is in the future, force status to NOT_STARTED
            if (matchTime > now) {
                var isFinishedState = validated.status_id === enums_1.MatchState.END ||
                    validated.status_id === enums_1.MatchState.CANCEL ||
                    validated.status_id === enums_1.MatchState.INTERRUPT;
                if (isFinishedState) {
                    logger_1.logger.warn("Match ".concat(validated.external_id, " has status ").concat(validated.status_id, " (finished) but match_time (").concat(matchDate.toISOString(), ") ") +
                        "is in the future (now: ".concat(nowDate.toISOString(), "). Fixing status to NOT_STARTED."));
                    validated.status_id = enums_1.MatchState.NOT_STARTED;
                    validated.ended = false;
                }
            }
        }
        // Ensure match_time is treated as UTC (Unix timestamp)
        if (validated.match_time && validated.match_time < 1000000000) {
            logger_1.logger.debug("Match ".concat(validated.external_id, " match_time: ").concat(validated.match_time, " (Unix seconds)"));
        }
        return validated;
    };
    /**
     * Upsert match to database
     */
    MatchSyncService.prototype.upsertMatch = function (client, matchData) {
        return __awaiter(this, void 0, void 0, function () {
            var hasNewColumns, hasIncidents, hasStatistics, hasCompensation, baseColumns, values, paramIndex, baseValues, columns, placeholders, scoreValues, incidentsValue, statisticsValue, compensationValues_1, homeScoresValue, awayScoresValue, updateClause, query;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
            return __generator(this, function (_z) {
                switch (_z.label) {
                    case 0: return [4 /*yield*/, this.ensureMatchColumnSupport(client)];
                    case 1:
                        _z.sent();
                        hasNewColumns = this.hasNewScoreColumns;
                        hasIncidents = this.hasIncidentsColumn;
                        hasStatistics = this.hasStatisticsColumn;
                        hasCompensation = this.hasCompensationColumns;
                        // Debug: Log problematic data types for JSONB columns
                        if (hasIncidents && matchData.incidents != null && typeof matchData.incidents === 'string') {
                            logger_1.logger.debug("\u26A0\uFE0F [MatchSync] incidents is string, will parse: ".concat(matchData.incidents.substring(0, 50), "..."));
                        }
                        if (hasStatistics && matchData.statistics != null && typeof matchData.statistics === 'string') {
                            logger_1.logger.debug("\u26A0\uFE0F [MatchSync] statistics is string, will parse: ".concat(matchData.statistics.substring(0, 50), "..."));
                        }
                        baseColumns = [
                            'external_id',
                            'season_id',
                            'competition_id',
                            'home_team_id',
                            'away_team_id',
                            'status_id',
                            'match_time',
                            'venue_id',
                            'referee_id',
                            'neutral',
                            'note',
                            'home_position',
                            'away_position',
                            'coverage_mlive',
                            'coverage_lineup',
                            'stage_id',
                            'group_num',
                            'round_num',
                            'related_id',
                            'agg_score',
                            'environment_weather',
                            'environment_pressure',
                            'environment_temperature',
                            'environment_wind',
                            'environment_humidity',
                            'tbd',
                            'has_ot',
                            'ended',
                            'team_reverse',
                            'external_updated_at',
                        ];
                        values = [];
                        paramIndex = 1;
                        baseValues = [
                            matchData.external_id,
                            matchData.season_id || null,
                            matchData.competition_id || null,
                            matchData.home_team_id || null,
                            matchData.away_team_id || null,
                            (_a = matchData.status_id) !== null && _a !== void 0 ? _a : null,
                            (_b = matchData.match_time) !== null && _b !== void 0 ? _b : null,
                            matchData.venue_id || null,
                            matchData.referee_id || null,
                            (_c = matchData.neutral) !== null && _c !== void 0 ? _c : null,
                            matchData.note || null,
                            // CRITICAL FIX: Ensure integer fields are properly typed (null or number, never string/undefined)
                            matchData.home_position != null ? Number(matchData.home_position) : null,
                            matchData.away_position != null ? Number(matchData.away_position) : null,
                            (_d = matchData.coverage_mlive) !== null && _d !== void 0 ? _d : null,
                            (_e = matchData.coverage_lineup) !== null && _e !== void 0 ? _e : null,
                            matchData.stage_id || null,
                            matchData.group_num != null ? Number(matchData.group_num) : null,
                            matchData.round_num != null ? Number(matchData.round_num) : null,
                            matchData.related_id || null,
                            matchData.agg_score || null,
                            matchData.environment_weather || null,
                            matchData.environment_pressure || null,
                            matchData.environment_temperature || null,
                            matchData.environment_wind || null,
                            matchData.environment_humidity || null,
                            (_f = matchData.tbd) !== null && _f !== void 0 ? _f : null,
                            (_g = matchData.has_ot) !== null && _g !== void 0 ? _g : null,
                            (_h = matchData.ended) !== null && _h !== void 0 ? _h : null,
                            (_j = matchData.team_reverse) !== null && _j !== void 0 ? _j : null,
                            (_k = matchData.external_updated_at) !== null && _k !== void 0 ? _k : null,
                        ];
                        values.push.apply(values, baseValues);
                        paramIndex += baseValues.length;
                        columns = __spreadArray([], baseColumns, true);
                        placeholders = baseValues.map(function (_, i) { return "$".concat(i + 1); }).join(', ');
                        // Add new score columns if they exist
                        if (hasNewColumns) {
                            columns.push('home_score_regular', 'home_score_overtime', 'home_score_penalties', 'home_score_display', 'away_score_regular', 'away_score_overtime', 'away_score_penalties', 'away_score_display');
                            scoreValues = [
                                (_l = matchData.home_score_regular) !== null && _l !== void 0 ? _l : null,
                                (_m = matchData.home_score_overtime) !== null && _m !== void 0 ? _m : null,
                                (_o = matchData.home_score_penalties) !== null && _o !== void 0 ? _o : null,
                                (_p = matchData.home_score_display) !== null && _p !== void 0 ? _p : null,
                                (_q = matchData.away_score_regular) !== null && _q !== void 0 ? _q : null,
                                (_r = matchData.away_score_overtime) !== null && _r !== void 0 ? _r : null,
                                (_s = matchData.away_score_penalties) !== null && _s !== void 0 ? _s : null,
                                (_t = matchData.away_score_display) !== null && _t !== void 0 ? _t : null,
                            ];
                            values.push.apply(values, scoreValues);
                            placeholders += ', ' + scoreValues.map(function (_, i) { return "$".concat(paramIndex + i); }).join(', ');
                            paramIndex += scoreValues.length;
                        }
                        // Add JSONB columns if they exist
                        // CRITICAL FIX: Use JSON.stringify + ::jsonb cast for proper JSONB serialization
                        // This ensures arrays, nested arrays, and objects are correctly stored as JSONB
                        if (hasIncidents) {
                            columns.push('incidents');
                            incidentsValue = null;
                            if (matchData.incidents != null) {
                                try {
                                    // Stringify to ensure valid JSON format, SQL will cast to jsonb
                                    incidentsValue = JSON.stringify(matchData.incidents);
                                }
                                catch (_0) {
                                    incidentsValue = null; // Invalid data, skip
                                }
                            }
                            values.push(incidentsValue);
                            // Use ::jsonb cast in placeholder to ensure proper type conversion
                            placeholders += ", $".concat(paramIndex, "::jsonb");
                            paramIndex++;
                        }
                        if (hasStatistics) {
                            columns.push('statistics');
                            statisticsValue = null;
                            if (matchData.statistics != null) {
                                try {
                                    // Stringify to ensure valid JSON format, SQL will cast to jsonb
                                    statisticsValue = JSON.stringify(matchData.statistics);
                                }
                                catch (_1) {
                                    statisticsValue = null; // Invalid data, skip
                                }
                            }
                            values.push(statisticsValue);
                            // Use ::jsonb cast in placeholder to ensure proper type conversion
                            placeholders += ", $".concat(paramIndex, "::jsonb");
                            paramIndex++;
                        }
                        // Add compensation columns if they exist
                        if (hasCompensation) {
                            columns.push('home_win_rate', 'away_win_rate', 'draw_rate', 'home_recent_win_rate', 'away_recent_win_rate', 'compensation_data');
                            compensationValues_1 = [
                                (_u = matchData.home_win_rate) !== null && _u !== void 0 ? _u : null,
                                (_v = matchData.away_win_rate) !== null && _v !== void 0 ? _v : null,
                                (_w = matchData.draw_rate) !== null && _w !== void 0 ? _w : null,
                                (_x = matchData.home_recent_win_rate) !== null && _x !== void 0 ? _x : null,
                                (_y = matchData.away_recent_win_rate) !== null && _y !== void 0 ? _y : null,
                                matchData.compensation_data != null ? JSON.stringify(matchData.compensation_data) : null,
                            ];
                            values.push.apply(values, compensationValues_1);
                            placeholders += ', ' + compensationValues_1.map(function (val, i) {
                                // Last column (compensation_data) is JSONB
                                if (i === compensationValues_1.length - 1) {
                                    return "$".concat(paramIndex + i, "::jsonb");
                                }
                                return "$".concat(paramIndex + i);
                            }).join(', ');
                            paramIndex += compensationValues_1.length;
                        }
                        // Handle home_scores and away_scores (legacy arrays - stored as JSONB)
                        // CRITICAL FIX: JSON.stringify + ::jsonb cast ensures proper array serialization
                        columns.push('home_scores', 'away_scores');
                        homeScoresValue = null;
                        awayScoresValue = null;
                        if (matchData.home_scores != null) {
                            try {
                                // Stringify array (even empty arrays or nested arrays) to valid JSON string
                                homeScoresValue = JSON.stringify(matchData.home_scores);
                            }
                            catch (_2) {
                                homeScoresValue = null; // Invalid data, skip
                            }
                        }
                        if (matchData.away_scores != null) {
                            try {
                                // Stringify array (even empty arrays or nested arrays) to valid JSON string
                                awayScoresValue = JSON.stringify(matchData.away_scores);
                            }
                            catch (_3) {
                                awayScoresValue = null; // Invalid data, skip
                            }
                        }
                        values.push(homeScoresValue, awayScoresValue);
                        // Use ::jsonb cast in placeholders for proper type conversion
                        placeholders += ", $".concat(paramIndex, "::jsonb, $").concat(paramIndex + 1, "::jsonb");
                        paramIndex += 2;
                        updateClause = columns
                            .filter(function (col) { return col !== 'external_id'; })
                            .map(function (col) { return "".concat(col, " = EXCLUDED.").concat(col); })
                            .join(', ');
                        query = "\n      INSERT INTO ts_matches (".concat(columns.join(', '), ", created_at, updated_at)\n      VALUES (").concat(placeholders, ", NOW(), NOW())\n      ON CONFLICT (external_id)\n      DO UPDATE SET ").concat(updateClause, ", updated_at = NOW()\n    ");
                        return [4 /*yield*/, client.query(query, values)];
                    case 2:
                        _z.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Batch sync matches
     */
    MatchSyncService.prototype.syncMatches = function (matches, resultsExtra) {
        return __awaiter(this, void 0, void 0, function () {
            var synced, errors, rejectedReasons, i, match, error_2, rejectReason, errorDetails, reasonKey, topReasons;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        synced = 0;
                        errors = 0;
                        rejectedReasons = {};
                        logger_1.logger.info("\uD83D\uDD04 [MatchSync] Starting to sync ".concat(matches.length, " matches..."));
                        i = 0;
                        _d.label = 1;
                    case 1:
                        if (!(i < matches.length)) return [3 /*break*/, 6];
                        match = matches[i];
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        // CRITICAL: Pass resultsExtra to enable seed-on-the-fly
                        return [4 /*yield*/, this.syncMatch(match, resultsExtra)];
                    case 3:
                        // CRITICAL: Pass resultsExtra to enable seed-on-the-fly
                        _d.sent();
                        synced++;
                        // Log progress every 50 matches
                        if ((i + 1) % 50 === 0 || i === matches.length - 1) {
                            logger_1.logger.info("\uD83D\uDCCA [MatchSync] Progress: ".concat(i + 1, "/").concat(matches.length, " matches processed (").concat(synced, " synced, ").concat(errors, " errors)"));
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _d.sent();
                        rejectReason = error_2.message || String(error_2);
                        errorDetails = {
                            match_id: match.external_id,
                            raw_competition_id: match.competition_id,
                            raw_home_team_id: match.home_team_id,
                            raw_away_team_id: match.away_team_id,
                            match_time: match.match_time,
                            reject_reason: rejectReason,
                            error_code: error_2.code,
                            error_detail: error_2.detail,
                            error_constraint: error_2.constraint,
                            error_column: error_2.column,
                        };
                        // Detect error type
                        if (rejectReason.includes('REJECTED:')) {
                            errorDetails.error_type = 'VALIDATION_REJECTION';
                        }
                        else if ((_a = error_2.message) === null || _a === void 0 ? void 0 : _a.includes('null value in column')) {
                            errorDetails.error_type = 'NULL_CONSTRAINT_VIOLATION';
                            errorDetails.null_column = error_2.column || 'unknown';
                        }
                        else if ((_b = error_2.message) === null || _b === void 0 ? void 0 : _b.includes('foreign key constraint')) {
                            errorDetails.error_type = 'FOREIGN_KEY_VIOLATION';
                        }
                        else if ((_c = error_2.message) === null || _c === void 0 ? void 0 : _c.includes('duplicate key')) {
                            errorDetails.error_type = 'DUPLICATE_KEY';
                        }
                        else {
                            errorDetails.error_type = 'UNKNOWN_ERROR';
                        }
                        logger_1.logger.error("\u274C [MatchSync] REJECTED match ".concat(match.external_id, ":"), errorDetails);
                        reasonKey = errorDetails.error_type || 'UNKNOWN_ERROR';
                        rejectedReasons[reasonKey] = (rejectedReasons[reasonKey] || 0) + 1;
                        errors++;
                        return [3 /*break*/, 5];
                    case 5:
                        i++;
                        return [3 /*break*/, 1];
                    case 6:
                        topReasons = Object.entries(rejectedReasons)
                            .sort(function (a, b) { return b[1] - a[1]; })
                            .slice(0, 3)
                            .map(function (_a) {
                            var reason = _a[0], count = _a[1];
                            return "".concat(reason, ": ").concat(count);
                        })
                            .join(', ');
                        logger_1.logger.info("\u2705 [MatchSync] Completed: ".concat(synced, "/").concat(matches.length, " matches synced, ").concat(errors, " errors"));
                        if (errors > 0) {
                            logger_1.logger.warn("\u26A0\uFE0F [MatchSync] ".concat(errors, " matches failed to sync. Top rejection reasons: ").concat(topReasons || 'none'));
                        }
                        return [2 /*return*/, { synced: synced, errors: errors, rejectedReasons: rejectedReasons }];
                }
            });
        });
    };
    return MatchSyncService;
}());
exports.MatchSyncService = MatchSyncService;

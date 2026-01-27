"use strict";
/**
 * Team Controller
 *
 * Handles team-related API endpoints
 */
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
exports.searchTeams = exports.getTeamStandings = exports.getTeamFixtures = exports.getTeamById = void 0;
var connection_1 = require("../database/connection");
var standings_service_1 = require("../services/thesports/season/standings.service");
var logger_1 = require("../utils/logger");
var seasonStandingsService = new standings_service_1.SeasonStandingsService();
/**
 * Get team by ID
 * GET /api/teams/:team_id
 */
var getTeamById = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var team_id_1, client, teamResult, team, seasonResult, currentSeasonId, competition, compResult, formResult, recentForm, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 10, , 11]);
                team_id_1 = request.params.team_id;
                return [4 /*yield*/, connection_1.pool.connect()];
            case 1:
                client = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 8, 9]);
                return [4 /*yield*/, client.query("SELECT external_id, name, short_name, logo_url, country_id, competition_id\n         FROM ts_teams WHERE external_id = $1", [team_id_1])];
            case 3:
                teamResult = _b.sent();
                if (teamResult.rows.length === 0) {
                    reply.status(404).send({
                        success: false,
                        message: 'Team not found',
                    });
                    return [2 /*return*/];
                }
                team = teamResult.rows[0];
                return [4 /*yield*/, client.query("SELECT season_id, competition_id \n         FROM ts_matches \n         WHERE home_team_id = $1 OR away_team_id = $1\n         ORDER BY match_time DESC\n         LIMIT 1", [team_id_1])];
            case 4:
                seasonResult = _b.sent();
                currentSeasonId = ((_a = seasonResult.rows[0]) === null || _a === void 0 ? void 0 : _a.season_id) || null;
                competition = null;
                if (!team.competition_id) return [3 /*break*/, 6];
                return [4 /*yield*/, client.query("SELECT external_id, name, logo_url FROM ts_competitions WHERE external_id = $1", [team.competition_id])];
            case 5:
                compResult = _b.sent();
                competition = compResult.rows[0] || null;
                _b.label = 6;
            case 6: return [4 /*yield*/, client.query("SELECT \n          m.external_id,\n          m.home_team_id,\n          m.away_team_id,\n          m.home_score_display,\n          m.away_score_display,\n          m.match_time,\n          m.status_id,\n          ht.name as home_team_name,\n          at.name as away_team_name\n         FROM ts_matches m\n         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n         WHERE (m.home_team_id = $1 OR m.away_team_id = $1)\n           AND m.status_id = 8\n         ORDER BY m.match_time DESC\n         LIMIT 5", [team_id_1])];
            case 7:
                formResult = _b.sent();
                recentForm = formResult.rows.map(function (match) {
                    var _a, _b;
                    var isHome = match.home_team_id === team_id_1;
                    var teamScore = isHome ? match.home_score_display : match.away_score_display;
                    var opponentScore = isHome ? match.away_score_display : match.home_score_display;
                    var result = 'D';
                    if (teamScore > opponentScore)
                        result = 'W';
                    else if (teamScore < opponentScore)
                        result = 'L';
                    return {
                        match_id: match.external_id,
                        result: result,
                        score: "".concat((_a = match.home_score_display) !== null && _a !== void 0 ? _a : 0, "-").concat((_b = match.away_score_display) !== null && _b !== void 0 ? _b : 0),
                        opponent: isHome ? match.away_team_name : match.home_team_name,
                        isHome: isHome,
                        date: new Date(match.match_time * 1000).toISOString().split('T')[0],
                    };
                });
                reply.send({
                    success: true,
                    data: {
                        id: team.external_id,
                        name: team.name,
                        short_name: team.short_name,
                        logo_url: team.logo_url,
                        country_id: team.country_id,
                        competition: competition,
                        current_season_id: currentSeasonId,
                        recent_form: recentForm,
                    },
                });
                return [3 /*break*/, 9];
            case 8:
                client.release();
                return [7 /*endfinally*/];
            case 9: return [3 /*break*/, 11];
            case 10:
                error_1 = _b.sent();
                logger_1.logger.error('[TeamController] Error in getTeamById:', error_1);
                reply.status(500).send({
                    success: false,
                    message: error_1.message || 'Internal server error',
                });
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); };
exports.getTeamById = getTeamById;
/**
 * Get team fixtures (past and upcoming matches)
 * GET /api/teams/:team_id/fixtures
 */
/**
 * Get team fixtures (past and upcoming matches)
 * GET /api/teams/:team_id/fixtures
 * REFACTORED: DB-First to support multiple competitions (League, Cup, UCL)
 */
var getTeamFixtures = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var team_id_2, _a, _b, limit, season_id, client, whereClause, params, paramIndex, result, matches, now_1, pastMatches, upcomingMatches, error_2;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                team_id_2 = request.params.team_id;
                _a = request.query, _b = _a.limit, limit = _b === void 0 ? '100' : _b, season_id = _a.season_id;
                return [4 /*yield*/, connection_1.pool.connect()];
            case 1:
                client = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 5]);
                whereClause = "(m.home_team_id = $1 OR m.away_team_id = $1)";
                params = [team_id_2];
                paramIndex = 2;
                if (season_id) {
                    whereClause += " AND m.season_id = $".concat(paramIndex++);
                    params.push(season_id);
                }
                return [4 /*yield*/, client.query("SELECT \n          m.external_id as id,\n          m.match_time,\n          m.status_id,\n          m.home_team_id,\n          m.away_team_id,\n          COALESCE(m.home_score_display, 0) as home_score_display,\n          COALESCE(m.away_score_display, 0) as away_score_display,\n          m.season_id,\n          m.competition_id,\n          c.name as competition_name,\n          c.logo_url as competition_logo,\n          c.short_name as competition_short_name,\n          ht.name as home_team_name,\n          ht.logo_url as home_team_logo,\n          at.name as away_team_name,\n          at.logo_url as away_team_logo\n         FROM ts_matches m\n         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n         LEFT JOIN ts_competitions c ON m.competition_id = c.external_id\n         WHERE ".concat(whereClause, "\n         ORDER BY m.match_time DESC\n         LIMIT $").concat(paramIndex), __spreadArray(__spreadArray([], params, true), [parseInt(limit)], false))];
            case 3:
                result = _c.sent();
                matches = result.rows.map(function (m) { return ({
                    id: m.id,
                    match_time: m.match_time,
                    status_id: m.status_id,
                    competition: {
                        id: m.competition_id,
                        name: m.competition_name,
                        short_name: m.competition_short_name,
                        logo_url: m.competition_logo
                    },
                    home_team: {
                        id: m.home_team_id,
                        name: m.home_team_name,
                        logo_url: m.home_team_logo,
                    },
                    away_team: {
                        id: m.away_team_id,
                        name: m.away_team_name,
                        logo_url: m.away_team_logo,
                    },
                    home_score: m.home_score_display,
                    away_score: m.away_score_display,
                    is_home: m.home_team_id === team_id_2,
                }); });
                now_1 = Math.floor(Date.now() / 1000);
                pastMatches = matches.filter(function (m) { return m.status_id === 8 || m.match_time < now_1 - 7200; });
                upcomingMatches = matches
                    .filter(function (m) { return m.status_id !== 8 && m.match_time >= now_1 - 7200; })
                    .sort(function (a, b) { return a.match_time - b.match_time; });
                reply.send({
                    success: true,
                    data: {
                        team_id: team_id_2,
                        total_matches: matches.length,
                        past_matches: pastMatches, // Already ordered DESC (most recent first)
                        upcoming_matches: upcomingMatches,
                        source: 'database_multi_comp',
                    },
                });
                return [3 /*break*/, 5];
            case 4:
                client.release();
                return [7 /*endfinally*/];
            case 5: return [3 /*break*/, 7];
            case 6:
                error_2 = _c.sent();
                logger_1.logger.error('[TeamController] Error in getTeamFixtures:', error_2);
                reply.status(500).send({
                    success: false,
                    message: error_2.message || 'Internal server error',
                });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.getTeamFixtures = getTeamFixtures;
/**
 * Get team's position in standings
 * GET /api/teams/:team_id/standings
 * DATABASE-FIRST: Check DB first, then API fallback
 */
var getTeamStandings = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var client, team_id_3, season_id, teamResult, teamCompetitionId_1, seasonResult, preferredSeason, dbStandings, standingsData, source, storedStandings, apiResponse, existingRow, apiError_1, teamStanding, error_3;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, connection_1.pool.connect()];
            case 1:
                client = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, 16, 17, 18]);
                team_id_3 = request.params.team_id;
                season_id = request.query.season_id;
                return [4 /*yield*/, client.query("SELECT competition_id FROM ts_teams WHERE external_id = $1", [team_id_3])];
            case 3:
                teamResult = _c.sent();
                teamCompetitionId_1 = (_a = teamResult.rows[0]) === null || _a === void 0 ? void 0 : _a.competition_id;
                if (!!season_id) return [3 /*break*/, 5];
                return [4 /*yield*/, client.query("SELECT DISTINCT m.season_id, m.competition_id, COUNT(*) as match_count\n         FROM ts_matches m\n         WHERE (m.home_team_id = $1 OR m.away_team_id = $1)\n         GROUP BY m.season_id, m.competition_id\n         ORDER BY match_count DESC\n         LIMIT 5", [team_id_3])];
            case 4:
                seasonResult = _c.sent();
                preferredSeason = seasonResult.rows.find(function (r) { return r.competition_id === teamCompetitionId_1; });
                season_id = (preferredSeason === null || preferredSeason === void 0 ? void 0 : preferredSeason.season_id) || ((_b = seasonResult.rows[0]) === null || _b === void 0 ? void 0 : _b.season_id);
                _c.label = 5;
            case 5:
                if (!season_id) {
                    reply.status(404).send({
                        success: false,
                        message: 'No season found for this team',
                    });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, client.query("SELECT standings, competition_id FROM ts_standings WHERE season_id = $1", [season_id])];
            case 6:
                dbStandings = _c.sent();
                standingsData = [];
                source = 'database';
                if (dbStandings.rows.length > 0 && dbStandings.rows[0].standings) {
                    storedStandings = dbStandings.rows[0].standings;
                    if (Array.isArray(storedStandings)) {
                        standingsData = storedStandings;
                    }
                    else if (typeof storedStandings === 'object') {
                        // Sometimes standings is stored as { overall: [...] } or similar
                        standingsData = storedStandings.overall || storedStandings.total || Object.values(storedStandings).flat();
                    }
                }
                if (!(standingsData.length === 0)) return [3 /*break*/, 15];
                logger_1.logger.info("[TeamController] No standings in DB for season ".concat(season_id, ", trying API..."));
                _c.label = 7;
            case 7:
                _c.trys.push([7, 14, , 15]);
                return [4 /*yield*/, seasonStandingsService.getSeasonStandings({ season_id: season_id })];
            case 8:
                apiResponse = _c.sent();
                if (!(apiResponse.results && Array.isArray(apiResponse.results))) return [3 /*break*/, 13];
                standingsData = apiResponse.results;
                source = 'api';
                return [4 /*yield*/, client.query("SELECT id FROM ts_standings WHERE season_id = $1", [season_id])];
            case 9:
                existingRow = _c.sent();
                if (!(existingRow.rows.length === 0)) return [3 /*break*/, 11];
                return [4 /*yield*/, client.query("INSERT INTO ts_standings (id, season_id, standings, updated_at)\n               VALUES (gen_random_uuid(), $1, $2, NOW())", [season_id, JSON.stringify(standingsData)])];
            case 10:
                _c.sent();
                logger_1.logger.info("[TeamController] Saved standings to DB for season ".concat(season_id));
                return [3 /*break*/, 13];
            case 11: return [4 /*yield*/, client.query("UPDATE ts_standings SET standings = $1, updated_at = NOW() WHERE season_id = $2", [JSON.stringify(standingsData), season_id])];
            case 12:
                _c.sent();
                logger_1.logger.info("[TeamController] Updated standings in DB for season ".concat(season_id));
                _c.label = 13;
            case 13: return [3 /*break*/, 15];
            case 14:
                apiError_1 = _c.sent();
                logger_1.logger.warn("[TeamController] API fallback failed: ".concat(apiError_1.message));
                return [3 /*break*/, 15];
            case 15:
                if (standingsData.length === 0) {
                    reply.status(404).send({
                        success: false,
                        message: 'No standings data found',
                    });
                    return [2 /*return*/];
                }
                teamStanding = standingsData.find(function (s) { return s.team_id === team_id_3; });
                if (!teamStanding) {
                    // Return standings anyway but indicate team not found in this particular season
                    reply.send({
                        success: true,
                        data: {
                            season_id: season_id,
                            team_id: team_id_3,
                            standing: null,
                            standings: standingsData,
                            total_teams: standingsData.length,
                            source: source,
                            message: 'Team not found in this standings table',
                        },
                    });
                    return [2 /*return*/];
                }
                reply.send({
                    success: true,
                    data: {
                        season_id: season_id,
                        team_id: team_id_3,
                        standing: teamStanding,
                        standings: standingsData,
                        total_teams: standingsData.length,
                        source: source,
                    },
                });
                return [3 /*break*/, 18];
            case 16:
                error_3 = _c.sent();
                logger_1.logger.error('[TeamController] Error in getTeamStandings:', error_3);
                reply.status(500).send({
                    success: false,
                    message: error_3.message || 'Internal server error',
                });
                return [3 /*break*/, 18];
            case 17:
                client.release();
                return [7 /*endfinally*/];
            case 18: return [2 /*return*/];
        }
    });
}); };
exports.getTeamStandings = getTeamStandings;
/**
 * Search teams by name
 * GET /api/teams/search
 */
var searchTeams = function (request, reply) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, q, _b, limit, client, result, error_4;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 6, , 7]);
                _a = request.query, q = _a.q, _b = _a.limit, limit = _b === void 0 ? '20' : _b;
                if (!q || q.length < 2) {
                    reply.send({
                        success: true,
                        data: [],
                    });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, connection_1.pool.connect()];
            case 1:
                client = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 5]);
                return [4 /*yield*/, client.query("SELECT external_id, name, logo_url, country_id \n         FROM ts_teams \n         WHERE name ILIKE $1 \n         ORDER BY name ASC \n         LIMIT $2", ["%".concat(q, "%"), parseInt(limit)])];
            case 3:
                result = _c.sent();
                reply.send({
                    success: true,
                    data: result.rows.map(function (row) { return ({
                        id: row.external_id,
                        name: row.name,
                        logo_url: row.logo_url,
                        country_id: row.country_id,
                    }); }),
                });
                return [3 /*break*/, 5];
            case 4:
                client.release();
                return [7 /*endfinally*/];
            case 5: return [3 /*break*/, 7];
            case 6:
                error_4 = _c.sent();
                logger_1.logger.error('[TeamController] Error in searchTeams:', error_4);
                reply.status(500).send({
                    success: false,
                    message: error_4.message || 'Internal server error',
                });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.searchTeams = searchTeams;

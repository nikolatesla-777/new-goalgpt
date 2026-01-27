"use strict";
/**
 * League Controller
 *
 * Handles league/competition-related API endpoints
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
exports.getLeagueById = getLeagueById;
exports.getLeagueTeams = getLeagueTeams;
exports.getLeagueFixtures = getLeagueFixtures;
exports.getLeagueStandings = getLeagueStandings;
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
/**
 * Get league by ID
 * GET /api/leagues/:league_id
 */
function getLeagueById(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var league_id, client, leagueResult, league, seasonResult, currentSeason, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    league_id = request.params.league_id;
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, 6, 7]);
                    return [4 /*yield*/, client.query("\n      SELECT \n        c.id,\n        c.external_id,\n        c.name,\n        c.short_name,\n        c.logo_url,\n        c.country_id,\n        cn.name as country_name,\n        c.category_id\n      FROM ts_competitions c\n      LEFT JOIN ts_countries cn ON c.country_id = cn.external_id\n      WHERE c.external_id = $1\n    ", [league_id])];
                case 3:
                    leagueResult = _a.sent();
                    if (leagueResult.rows.length === 0) {
                        return [2 /*return*/, reply.status(404).send({ error: 'League not found' })];
                    }
                    league = leagueResult.rows[0];
                    return [4 /*yield*/, client.query("\n      SELECT external_id, year\n      FROM ts_seasons\n      WHERE competition_id = $1\n      ORDER BY year DESC\n      LIMIT 1\n    ", [league_id])];
                case 4:
                    seasonResult = _a.sent();
                    currentSeason = seasonResult.rows[0] || null;
                    return [2 /*return*/, reply.send({
                            league: league,
                            currentSeason: currentSeason,
                        })];
                case 5:
                    error_1 = _a.sent();
                    logger_1.logger.error('Error fetching league:', { message: error_1.message, stack: error_1.stack });
                    return [2 /*return*/, reply.status(500).send({ error: 'Internal server error', details: error_1.message })];
                case 6:
                    client.release();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get league teams
 * GET /api/leagues/:league_id/teams
 */
function getLeagueTeams(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var league_id, client, teamsResult, teams, matchTeamsResult, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    league_id = request.params.league_id;
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, 7, 8]);
                    return [4 /*yield*/, client.query("\n      SELECT DISTINCT ON (t.external_id)\n        t.external_id,\n        t.name,\n        t.short_name,\n        t.logo_url\n      FROM ts_teams t\n      WHERE t.competition_id = $1\n      ORDER BY t.external_id, t.name\n    ", [league_id])];
                case 3:
                    teamsResult = _a.sent();
                    teams = teamsResult.rows;
                    if (!(teams.length === 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, client.query("\n        SELECT DISTINCT t.external_id, t.name, t.short_name, t.logo_url\n        FROM ts_matches m\n        JOIN ts_teams t ON (t.external_id = m.home_team_id OR t.external_id = m.away_team_id)\n        WHERE m.competition_id = $1\n        ORDER BY t.name\n      ", [league_id])];
                case 4:
                    matchTeamsResult = _a.sent();
                    teams = matchTeamsResult.rows;
                    _a.label = 5;
                case 5: return [2 /*return*/, reply.send({ teams: teams })];
                case 6:
                    error_2 = _a.sent();
                    logger_1.logger.error('Error fetching league teams:', error_2);
                    return [2 /*return*/, reply.status(500).send({ error: 'Internal server error' })];
                case 7:
                    client.release();
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get league fixtures
 * GET /api/leagues/:league_id/fixtures
 */
function getLeagueFixtures(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var league_id, _a, _b, limit, status, client, whereClause, params, fixturesResult, fixtures, error_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    league_id = request.params.league_id;
                    _a = request.query, _b = _a.limit, limit = _b === void 0 ? '50' : _b, status = _a.status;
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _c.sent();
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, 5, 6]);
                    whereClause = 'm.competition_id = $1';
                    params = [league_id];
                    if (status === 'upcoming') {
                        whereClause += ' AND m.status_id = 1';
                    }
                    else if (status === 'finished') {
                        whereClause += ' AND m.status_id = 8';
                    }
                    else if (status === 'live') {
                        whereClause += ' AND m.status_id IN (2, 3, 4, 5, 7)';
                    }
                    return [4 /*yield*/, client.query("\n      SELECT \n        m.external_id as id,\n        m.match_time,\n        m.status_id,\n        m.round,\n        m.home_team_id,\n        ht.name as home_team_name,\n        ht.logo_url as home_team_logo,\n        m.away_team_id,\n        at.name as away_team_name,\n        at.logo_url as away_team_logo,\n        m.home_score_display as home_score,\n        m.away_score_display as away_score\n      FROM ts_matches m\n      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n      WHERE ".concat(whereClause, "\n      ORDER BY m.match_time DESC\n      LIMIT $2\n    "), __spreadArray(__spreadArray([], params, true), [parseInt(limit)], false))];
                case 3:
                    fixturesResult = _c.sent();
                    fixtures = fixturesResult.rows.map(function (row) { return ({
                        id: row.id,
                        match_time: row.match_time,
                        status_id: row.status_id,
                        round: row.round,
                        home_team: {
                            id: row.home_team_id,
                            name: row.home_team_name,
                            logo_url: row.home_team_logo,
                        },
                        away_team: {
                            id: row.away_team_id,
                            name: row.away_team_name,
                            logo_url: row.away_team_logo,
                        },
                        home_score: row.home_score,
                        away_score: row.away_score,
                    }); });
                    return [2 /*return*/, reply.send({ fixtures: fixtures })];
                case 4:
                    error_3 = _c.sent();
                    logger_1.logger.error('Error fetching league fixtures:', error_3);
                    return [2 /*return*/, reply.status(500).send({ error: 'Internal server error' })];
                case 5:
                    client.release();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get league standings
 * GET /api/leagues/:league_id/standings
 */
function getLeagueStandings(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var league_id, client, seasonResult, seasonId, standingsResult, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    league_id = request.params.league_id;
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, 6, 7]);
                    return [4 /*yield*/, client.query("\n      SELECT external_id\n      FROM ts_seasons\n      WHERE competition_id = $1\n      ORDER BY external_id DESC\n      LIMIT 1\n    ", [league_id])];
                case 3:
                    seasonResult = _a.sent();
                    if (seasonResult.rows.length === 0) {
                        return [2 /*return*/, reply.send({ standings: [] })];
                    }
                    seasonId = seasonResult.rows[0].external_id;
                    return [4 /*yield*/, client.query("\n      SELECT \n        s.position,\n        s.team_id,\n        t.name as team_name,\n        t.logo_url as team_logo,\n        s.played,\n        s.won,\n        s.drawn,\n        s.lost,\n        s.goals_for,\n        s.goals_against,\n        s.goal_diff,\n        s.points\n      FROM ts_standings s\n      LEFT JOIN ts_teams t ON s.team_id = t.external_id\n      WHERE s.season_id = $1\n      ORDER BY s.position ASC\n    ", [seasonId])];
                case 4:
                    standingsResult = _a.sent();
                    return [2 /*return*/, reply.send({
                            standings: standingsResult.rows,
                            season_id: seasonId,
                        })];
                case 5:
                    error_4 = _a.sent();
                    logger_1.logger.error('Error fetching league standings:', error_4);
                    return [2 /*return*/, reply.status(500).send({ error: 'Internal server error' })];
                case 6:
                    client.release();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}

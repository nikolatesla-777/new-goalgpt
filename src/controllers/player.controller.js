"use strict";
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
exports.getPlayerById = getPlayerById;
exports.searchPlayers = searchPlayers;
exports.getPlayersByTeam = getPlayersByTeam;
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
/**
 * Get player details by ID
 */
function getPlayerById(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var playerId, client, playerResult, player, matchesResult, matches, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    playerId = request.params.playerId;
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, 6, 7]);
                    return [4 /*yield*/, client.query("\n      SELECT \n        p.id,\n        p.external_id,\n        p.name,\n        p.short_name,\n        p.logo,\n        p.team_id,\n        t.name as team_name,\n        t.logo_url as team_logo,\n        p.country_id,\n        c.name as country_name,\n        p.nationality,\n        p.position,\n        p.shirt_number,\n        p.age,\n        p.birthday,\n        p.height,\n        p.weight,\n        p.market_value,\n        p.market_value_currency,\n        p.preferred_foot,\n        p.season_stats\n      FROM ts_players p\n      LEFT JOIN ts_teams t ON p.team_id = t.external_id\n      LEFT JOIN ts_countries c ON p.country_id = c.external_id\n      WHERE p.external_id = $1\n    ", [playerId])];
                case 3:
                    playerResult = _a.sent();
                    if (playerResult.rows.length === 0) {
                        return [2 /*return*/, reply.status(404).send({ error: 'Player not found' })];
                    }
                    player = playerResult.rows[0];
                    return [4 /*yield*/, client.query("\n      SELECT \n        m.id,\n        m.external_id,\n        ht.name as home_team_name,\n        at.name as away_team_name,\n        ht.logo_url as home_team_logo,\n        at.logo_url as away_team_logo,\n        m.home_score_display as home_score,\n        m.away_score_display as away_score,\n        m.match_time,\n        comp.name as competition_name,\n        m.player_stats\n      FROM ts_matches m\n      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id\n      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id\n      LEFT JOIN ts_competitions comp ON m.competition_id = comp.external_id\n      WHERE m.player_stats IS NOT NULL\n        AND m.player_stats @> $1::jsonb\n      ORDER BY m.match_time DESC\n      LIMIT 20\n    ", [JSON.stringify([{ player_id: playerId }])])];
                case 4:
                    matchesResult = _a.sent();
                    matches = matchesResult.rows.map(function (match) {
                        var _a, _b;
                        var playerStats = null;
                        if (match.player_stats) {
                            var stats = Array.isArray(match.player_stats)
                                ? match.player_stats
                                : [];
                            var playerMatchStats = stats.find(function (s) { return s.player_id === playerId; });
                            if (playerMatchStats) {
                                playerStats = {
                                    goals: playerMatchStats.goals,
                                    assists: playerMatchStats.assists,
                                    minutes_played: playerMatchStats.minutes_played,
                                    rating: playerMatchStats.rating,
                                };
                            }
                        }
                        return {
                            id: match.id,
                            external_id: match.external_id,
                            home_team_name: match.home_team_name,
                            away_team_name: match.away_team_name,
                            home_team_logo: match.home_team_logo,
                            away_team_logo: match.away_team_logo,
                            home_score: (_a = match.home_score) !== null && _a !== void 0 ? _a : 0,
                            away_score: (_b = match.away_score) !== null && _b !== void 0 ? _b : 0,
                            match_time: match.match_time,
                            competition_name: match.competition_name,
                            player_stats: playerStats,
                        };
                    });
                    return [2 /*return*/, reply.send({
                            player: player,
                            matches: matches,
                        })];
                case 5:
                    error_1 = _a.sent();
                    logger_1.logger.error('Error fetching player:', error_1);
                    return [2 /*return*/, reply.status(500).send({ error: 'Internal server error' })];
                case 6:
                    client.release();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Search players by name
 */
function searchPlayers(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var client, q, limit, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, 4, 5]);
                    q = request.query.q || '';
                    limit = parseInt(request.query.limit || '20', 10);
                    if (!q || q.length < 2) {
                        return [2 /*return*/, reply.send({ players: [] })];
                    }
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    return [4 /*yield*/, client.query("\n      SELECT\n        p.external_id,\n        p.name,\n        p.short_name,\n        p.logo,\n        p.position,\n        p.nationality,\n        t.name as team_name,\n        t.logo_url as team_logo\n      FROM ts_players p\n      LEFT JOIN ts_teams t ON p.team_id = t.external_id\n      WHERE p.name ILIKE $1\n        AND (p.is_duplicate = false OR p.is_duplicate IS NULL)\n      ORDER BY p.market_value DESC NULLS LAST\n      LIMIT $2\n    ", ["%".concat(q, "%"), limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, reply.send({ success: true, data: { players: result.rows } })];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error('Error searching players:', { error: error_2.message, stack: error_2.stack });
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: 'Internal server error',
                            details: error_2.message
                        })];
                case 4:
                    if (client) {
                        client.release();
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get players by team ID
 * Filters out duplicates using is_duplicate flag and name similarity
 */
function getPlayersByTeam(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var teamId, client, result, sortedPlayers, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    teamId = request.params.teamId || request.params.team_id;
                    if (!teamId) {
                        return [2 /*return*/, reply.status(400).send({ success: false, error: 'Team ID is required' })];
                    }
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, 5, 6]);
                    return [4 /*yield*/, client.query("\n      SELECT DISTINCT ON (\n        LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '', 'g'))\n      )\n        p.external_id,\n        p.name,\n        p.short_name,\n        p.logo,\n        p.position,\n        p.shirt_number,\n        p.age,\n        p.nationality,\n        p.market_value,\n        p.market_value_currency,\n        p.season_stats\n      FROM ts_players p\n      WHERE p.team_id = $1\n        AND (p.is_duplicate = false OR p.is_duplicate IS NULL)\n      ORDER BY\n        LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]', '', 'g')),\n        p.market_value DESC NULLS LAST,\n        CASE p.position\n          WHEN 'G' THEN 1\n          WHEN 'GK' THEN 1\n          WHEN 'D' THEN 2\n          WHEN 'DF' THEN 2\n          WHEN 'M' THEN 3\n          WHEN 'MF' THEN 3\n          WHEN 'F' THEN 4\n          WHEN 'FW' THEN 4\n          ELSE 5\n        END,\n        p.shirt_number NULLS LAST\n    ", [teamId])];
                case 3:
                    result = _a.sent();
                    sortedPlayers = result.rows.sort(function (a, b) {
                        var _a, _b;
                        var posOrder = {
                            'G': 1, 'GK': 1,
                            'D': 2, 'DF': 2,
                            'M': 3, 'MF': 3,
                            'F': 4, 'FW': 4
                        };
                        var posA = posOrder[a.position] || 5;
                        var posB = posOrder[b.position] || 5;
                        if (posA !== posB)
                            return posA - posB;
                        // Then by shirt number
                        var shirtA = (_a = a.shirt_number) !== null && _a !== void 0 ? _a : 999;
                        var shirtB = (_b = b.shirt_number) !== null && _b !== void 0 ? _b : 999;
                        if (shirtA !== shirtB)
                            return shirtA - shirtB;
                        // Then by name
                        return (a.name || '').localeCompare(b.name || '');
                    });
                    return [2 /*return*/, reply.send({ success: true, data: { players: sortedPlayers } })];
                case 4:
                    error_3 = _a.sent();
                    logger_1.logger.error('Error fetching team players:', error_3);
                    return [2 /*return*/, reply.status(500).send({ success: false, error: 'Internal server error' })];
                case 5:
                    client.release();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}

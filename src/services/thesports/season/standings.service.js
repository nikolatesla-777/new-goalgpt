"use strict";
/**
 * Season Standings Service
 *
 * Handles standings from /table/live endpoint (real-time standings)
 * Falls back to database cache when API returns no data
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
exports.SeasonStandingsService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var connection_1 = require("../../../database/connection");
var SeasonStandingsService = /** @class */ (function () {
    function SeasonStandingsService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get season standings - tries API first, falls back to DB
     * Always enriches with team names from ts_teams table
     */
    SeasonStandingsService.prototype.getSeasonStandings = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var season_id, cacheKey, cached, standings, liveResponse, returnedSeasonIds, seasonStandings, error_1, dbStandings, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        season_id = params.season_id;
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":season:standings:").concat(season_id);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _a.sent();
                        if (cached && cached.results && Array.isArray(cached.results) && cached.results.length > 0) {
                            logger_1.logger.debug("Cache hit for season standings: ".concat(cacheKey));
                            return [2 /*return*/, cached];
                        }
                        standings = [];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 7, , 8]);
                        logger_1.logger.info("Fetching standings from /table/live for season: ".concat(season_id));
                        return [4 /*yield*/, this.client.get('/table/live', { season_id: season_id })];
                    case 3:
                        liveResponse = _a.sent();
                        if (!(liveResponse.results && Array.isArray(liveResponse.results))) return [3 /*break*/, 6];
                        returnedSeasonIds = liveResponse.results.map(function (r) { return r.season_id; });
                        logger_1.logger.info("/table/live returned ".concat(liveResponse.results.length, " seasons: ").concat(returnedSeasonIds.join(', ')));
                        seasonStandings = liveResponse.results.find(function (r) { return r.season_id === season_id; });
                        if (!(seasonStandings && seasonStandings.tables && seasonStandings.tables.length > 0)) return [3 /*break*/, 5];
                        // Parse standings
                        standings = this.parseTableLiveResponse(seasonStandings);
                        // Save raw to database (without team names - we'll enrich on read)
                        return [4 /*yield*/, this.saveStandingsToDb(season_id, standings, liveResponse)];
                    case 4:
                        // Save raw to database (without team names - we'll enrich on read)
                        _a.sent();
                        logger_1.logger.info("\u2705 Found matching standings for season ".concat(season_id, ": ").concat(standings.length, " teams"));
                        return [3 /*break*/, 6];
                    case 5:
                        // CRITICAL FIX: API returned data but for DIFFERENT seasons
                        // This happens for minor leagues where API doesn't have standings
                        logger_1.logger.warn("\u26A0\uFE0F /table/live returned data for seasons [".concat(returnedSeasonIds.join(', '), "] but NOT for requested season ").concat(season_id));
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_1 = _a.sent();
                        logger_1.logger.warn("/table/live failed for ".concat(season_id, ": ").concat(error_1.message));
                        return [3 /*break*/, 8];
                    case 8:
                        if (!(standings.length === 0)) return [3 /*break*/, 10];
                        logger_1.logger.info("Fetching standings from DB for season: ".concat(season_id));
                        return [4 /*yield*/, this.getStandingsFromDb(season_id)];
                    case 9:
                        dbStandings = _a.sent();
                        if (dbStandings && dbStandings.standings && Array.isArray(dbStandings.standings)) {
                            standings = dbStandings.standings;
                        }
                        _a.label = 10;
                    case 10:
                        if (!(standings.length > 0)) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.enrichWithTeamNames(standings)];
                    case 11:
                        standings = _a.sent();
                        response = { code: 0, results: standings };
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.FiveMinutes)];
                    case 12:
                        _a.sent();
                        return [2 /*return*/, response];
                    case 13:
                        // No data available
                        logger_1.logger.warn("No standings data found for season: ".concat(season_id));
                        return [2 /*return*/, { code: 0, results: [] }];
                }
            });
        });
    };
    /**
     * Enrich standings with team names from ts_teams table
     */
    SeasonStandingsService.prototype.enrichWithTeamNames = function (standings) {
        return __awaiter(this, void 0, void 0, function () {
            var teamIds, client, placeholders, result, teamMap_1, _i, _a, row;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!standings || standings.length === 0)
                            return [2 /*return*/, standings];
                        teamIds = standings.map(function (s) { return s.team_id; }).filter(Boolean);
                        if (teamIds.length === 0)
                            return [2 /*return*/, standings];
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, , 4, 5]);
                        placeholders = teamIds.map(function (_, i) { return "$".concat(i + 1); }).join(',');
                        return [4 /*yield*/, client.query("SELECT external_id, name, logo_url FROM ts_teams WHERE external_id IN (".concat(placeholders, ")"), teamIds)];
                    case 3:
                        result = _b.sent();
                        teamMap_1 = new Map();
                        for (_i = 0, _a = result.rows; _i < _a.length; _i++) {
                            row = _a[_i];
                            teamMap_1.set(row.external_id, { name: row.name, logo_url: row.logo_url });
                        }
                        // Enrich standings
                        return [2 /*return*/, standings.map(function (team) {
                                var _a, _b;
                                return (__assign(__assign({}, team), { team_name: ((_a = teamMap_1.get(team.team_id)) === null || _a === void 0 ? void 0 : _a.name) || null, team_logo: ((_b = teamMap_1.get(team.team_id)) === null || _b === void 0 ? void 0 : _b.logo_url) || null }));
                            })];
                    case 4:
                        client.release();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse /table/live response into our format
     */
    SeasonStandingsService.prototype.parseTableLiveResponse = function (seasonData) {
        var result = [];
        if (!seasonData.tables || !Array.isArray(seasonData.tables)) {
            return result;
        }
        for (var _i = 0, _a = seasonData.tables; _i < _a.length; _i++) {
            var table = _a[_i];
            if (!table.rows || !Array.isArray(table.rows))
                continue;
            for (var _b = 0, _c = table.rows; _b < _c.length; _b++) {
                var row = _c[_b];
                result.push({
                    position: row.position,
                    team_id: row.team_id,
                    team_name: row.team_name || null, // Will be enriched later
                    played: row.total || 0,
                    won: row.won || 0,
                    drawn: row.draw || 0,
                    lost: row.loss || 0,
                    goals_for: row.goals || 0,
                    goals_against: row.goals_against || 0,
                    goal_diff: row.goal_diff || 0,
                    points: row.points || 0,
                    // Additional details
                    home_played: row.home_total || 0,
                    home_won: row.home_won || 0,
                    home_drawn: row.home_draw || 0,
                    home_lost: row.home_loss || 0,
                    home_goals_for: row.home_goals || 0,
                    home_goals_against: row.home_goals_against || 0,
                    away_played: row.away_total || 0,
                    away_won: row.away_won || 0,
                    away_drawn: row.away_draw || 0,
                    away_lost: row.away_loss || 0,
                    away_goals_for: row.away_goals || 0,
                    away_goals_against: row.away_goals_against || 0,
                    promotion_id: row.promotion_id || null,
                    group: table.group || 0,
                });
            }
        }
        // Sort by position
        result.sort(function (a, b) { return a.position - b.position; });
        return result;
    };
    /**
     * Save standings to database
     */
    SeasonStandingsService.prototype.saveStandingsToDb = function (seasonId, standings, rawResponse) {
        return __awaiter(this, void 0, void 0, function () {
            var client;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 4, 5]);
                        return [4 /*yield*/, client.query("\n                INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)\n                VALUES ($1, $2, $3, NOW())\n                ON CONFLICT (season_id) DO UPDATE SET\n                    standings = EXCLUDED.standings,\n                    raw_response = EXCLUDED.raw_response,\n                    updated_at = NOW()\n            ", [seasonId, JSON.stringify(standings), JSON.stringify(rawResponse)])];
                    case 3:
                        _a.sent();
                        logger_1.logger.info("\u2705 Saved standings for season ".concat(seasonId, ": ").concat(standings.length, " teams"));
                        return [3 /*break*/, 5];
                    case 4:
                        client.release();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get standings from database
     */
    SeasonStandingsService.prototype.getStandingsFromDb = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 4, 5]);
                        return [4 /*yield*/, client.query('SELECT standings FROM ts_standings WHERE season_id = $1', [seasonId])];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.rows[0] || null];
                    case 4:
                        client.release();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return SeasonStandingsService;
}());
exports.SeasonStandingsService = SeasonStandingsService;

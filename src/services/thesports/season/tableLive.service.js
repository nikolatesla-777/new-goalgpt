"use strict";
/**
 * Table Live Service
 *
 * Handles real-time standings from /table/live endpoint
 * Note: /table/live returns ALL live league standings, then we filter by season_id
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableLiveService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var connection_1 = require("../../../database/connection");
var TableLiveService = /** @class */ (function () {
    function TableLiveService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get real-time standings with cache support
     * Note: /table/live returns all leagues with live matches
     */
    TableLiveService.prototype.getTableLive = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, response, filtered;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":table:live:all");
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        response = _a.sent();
                        if (!!response) return [3 /*break*/, 4];
                        logger_1.logger.info("Fetching all live standings from /table/live");
                        return [4 /*yield*/, this.client.get('/table/live', {})];
                    case 2:
                        response = _a.sent();
                        if (!(response && response.results)) return [3 /*break*/, 4];
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Minute)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        // Filter by season_id if provided
                        if (seasonId && (response === null || response === void 0 ? void 0 : response.results)) {
                            filtered = response.results.filter(function (r) { return r.season_id === seasonId; });
                            return [2 /*return*/, { code: response.code, results: filtered }];
                        }
                        return [2 /*return*/, response || { code: 0, results: [] }];
                }
            });
        });
    };
    /**
     * Sync standings to database for a season
     */
    TableLiveService.prototype.syncStandingsToDb = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, seasonData, standings, client, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, this.getTableLive(seasonId)];
                    case 1:
                        response = _a.sent();
                        if (!response.results || response.results.length === 0) {
                            logger_1.logger.debug("No live standings data for season ".concat(seasonId));
                            return [2 /*return*/];
                        }
                        seasonData = response.results[0];
                        if (!seasonData || !seasonData.tables || !Array.isArray(seasonData.tables)) {
                            logger_1.logger.debug("Invalid standings structure for season ".concat(seasonId));
                            return [2 /*return*/];
                        }
                        standings = this.parseTableLiveResponse(seasonData);
                        if (standings.length === 0) {
                            logger_1.logger.debug("No teams in standings for season ".concat(seasonId));
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 2:
                        client = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, , 5, 6]);
                        return [4 /*yield*/, client.query("\n                    INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)\n                    VALUES ($1, $2, $3, NOW())\n                    ON CONFLICT (season_id) \n                    DO UPDATE SET \n                        standings = EXCLUDED.standings,\n                        raw_response = EXCLUDED.raw_response,\n                        updated_at = NOW()\n                ", [seasonId, JSON.stringify(standings), JSON.stringify(response)])];
                    case 4:
                        _a.sent();
                        logger_1.logger.info("\u2705 Synced standings for season ".concat(seasonId, ": ").concat(standings.length, " teams"));
                        return [3 /*break*/, 6];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_1 = _a.sent();
                        logger_1.logger.error("Failed to sync standings for season ".concat(seasonId, ":"), error_1.message);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse /table/live response into our format
     */
    TableLiveService.prototype.parseTableLiveResponse = function (seasonData) {
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
                    played: row.total || 0,
                    won: row.won || 0,
                    drawn: row.draw || 0,
                    lost: row.loss || 0,
                    goals_for: row.goals || 0,
                    goals_against: row.goals_against || 0,
                    goal_diff: row.goal_diff || 0,
                    points: row.points || 0,
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
    return TableLiveService;
}());
exports.TableLiveService = TableLiveService;

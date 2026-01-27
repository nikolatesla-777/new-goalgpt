"use strict";
/**
 * Compensation Service
 *
 * Handles historical compensation data from /compensation/list endpoint
 * Returns H2H, recent record, and historical compensation for upcoming matches
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
exports.CompensationService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var connection_1 = require("../../../database/connection");
var CompensationService = /** @class */ (function () {
    function CompensationService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Get compensation list with pagination support
     */
    CompensationService.prototype.getCompensationList = function () {
        return __awaiter(this, arguments, void 0, function (page) {
            var cacheKey, cached, response;
            if (page === void 0) { page = 1; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":compensation:list:").concat(page);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _a.sent();
                        if (cached) {
                            logger_1.logger.debug("Cache hit for compensation list: ".concat(cacheKey));
                            return [2 /*return*/, cached];
                        }
                        logger_1.logger.info("Fetching compensation list page ".concat(page));
                        return [4 /*yield*/, this.client.get('/compensation/list', { page: page })];
                    case 2:
                        response = _a.sent();
                        // Cache for 30 minutes
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.FiveMinutes * 6)];
                    case 3:
                        // Cache for 30 minutes
                        _a.sent();
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Sync compensation data to database for a match
     * Updates both ts_compensation table and ts_matches table
     */
    CompensationService.prototype.syncCompensationToDb = function (matchData) {
        return __awaiter(this, void 0, void 0, function () {
            var client, history_1, recent, similar, homeWinRate, awayWinRate, drawRate, totalMatches, sum, homeRecentWinRate, awayRecentWinRate, columnCheck, hasCompensationColumns, error_1;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        if (!matchData.id)
                            return [2 /*return*/];
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _h.sent();
                        _h.label = 2;
                    case 2:
                        _h.trys.push([2, 7, 8, 9]);
                        history_1 = matchData.history || matchData.h2h || {};
                        recent = matchData.recent || matchData.recent_record || {};
                        similar = matchData.similar || matchData.historical_compensation || {};
                        homeWinRate = ((_a = history_1.home) === null || _a === void 0 ? void 0 : _a.rate) || null;
                        awayWinRate = ((_b = history_1.away) === null || _b === void 0 ? void 0 : _b.rate) || null;
                        drawRate = null;
                        if (((_c = history_1.home) === null || _c === void 0 ? void 0 : _c.won_count) != null && ((_d = history_1.home) === null || _d === void 0 ? void 0 : _d.drawn_count) != null && ((_e = history_1.home) === null || _e === void 0 ? void 0 : _e.lost_count) != null) {
                            totalMatches = history_1.home.won_count + history_1.home.drawn_count + history_1.home.lost_count;
                            if (totalMatches > 0) {
                                drawRate = history_1.home.drawn_count / totalMatches;
                            }
                        }
                        else if (homeWinRate != null && awayWinRate != null) {
                            sum = homeWinRate + awayWinRate;
                            if (sum < 1) {
                                drawRate = 1 - sum;
                            }
                        }
                        homeRecentWinRate = ((_f = recent.home) === null || _f === void 0 ? void 0 : _f.rate) || null;
                        awayRecentWinRate = ((_g = recent.away) === null || _g === void 0 ? void 0 : _g.rate) || null;
                        // 1. Update ts_compensation table (existing logic)
                        return [4 /*yield*/, client.query("\n                INSERT INTO ts_compensation (match_id, h2h_data, recent_record, historical_compensation, raw_response, updated_at)\n                VALUES ($1, $2, $3, $4, $5, NOW())\n                ON CONFLICT (match_id) \n                DO UPDATE SET \n                  h2h_data = EXCLUDED.h2h_data,\n                  recent_record = EXCLUDED.recent_record,\n                  historical_compensation = EXCLUDED.historical_compensation,\n                  raw_response = EXCLUDED.raw_response,\n                  updated_at = NOW()\n            ", [
                                matchData.id,
                                JSON.stringify(history_1),
                                JSON.stringify(recent),
                                JSON.stringify(similar),
                                JSON.stringify(matchData)
                            ])];
                    case 3:
                        // 1. Update ts_compensation table (existing logic)
                        _h.sent();
                        return [4 /*yield*/, client.query("\n                SELECT column_name\n                FROM information_schema.columns\n                WHERE table_name = 'ts_matches' \n                AND column_name IN ('home_win_rate', 'away_win_rate', 'draw_rate', 'home_recent_win_rate', 'away_recent_win_rate', 'compensation_data')\n            ")];
                    case 4:
                        columnCheck = _h.sent();
                        hasCompensationColumns = columnCheck.rows.length > 0;
                        if (!hasCompensationColumns) return [3 /*break*/, 6];
                        return [4 /*yield*/, client.query("\n                    UPDATE ts_matches\n                    SET \n                      home_win_rate = $1,\n                      away_win_rate = $2,\n                      draw_rate = $3,\n                      home_recent_win_rate = $4,\n                      away_recent_win_rate = $5,\n                      compensation_data = $6::jsonb,\n                      updated_at = NOW()\n                    WHERE external_id = $7\n                ", [
                                homeWinRate,
                                awayWinRate,
                                drawRate,
                                homeRecentWinRate,
                                awayRecentWinRate,
                                JSON.stringify(matchData),
                                matchData.id
                            ])];
                    case 5:
                        _h.sent();
                        _h.label = 6;
                    case 6:
                        logger_1.logger.debug("\u2705 Synced compensation for match ".concat(matchData.id));
                        return [3 /*break*/, 9];
                    case 7:
                        error_1 = _h.sent();
                        logger_1.logger.error("Failed to sync compensation for match ".concat(matchData.id, ":"), error_1.message);
                        return [3 /*break*/, 9];
                    case 8:
                        client.release();
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sync all compensation data (paginated)
     */
    CompensationService.prototype.syncAllCompensation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var page, totalSynced, hasMore, response, _i, _a, matchData;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = 1;
                        totalSynced = 0;
                        hasMore = true;
                        _b.label = 1;
                    case 1:
                        if (!hasMore) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.getCompensationList(page)];
                    case 2:
                        response = _b.sent();
                        if (!response.results || response.results.length === 0) {
                            hasMore = false;
                            return [3 /*break*/, 7];
                        }
                        _i = 0, _a = response.results;
                        _b.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        matchData = _a[_i];
                        return [4 /*yield*/, this.syncCompensationToDb(matchData)];
                    case 4:
                        _b.sent();
                        totalSynced++;
                        _b.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        // Check if there are more pages (TheSports typically returns 100 per page)
                        if (response.results.length < 100) {
                            hasMore = false;
                        }
                        else {
                            page++;
                        }
                        return [3 /*break*/, 1];
                    case 7:
                        logger_1.logger.info("\u2705 Synced ".concat(totalSynced, " compensation records"));
                        return [2 /*return*/, totalSynced];
                }
            });
        });
    };
    return CompensationService;
}());
exports.CompensationService = CompensationService;

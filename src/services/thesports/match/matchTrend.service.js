"use strict";
/**
 * Match Trend Service
 *
 * Handles business logic for /match/trend/live and /match/trend/detail endpoints
 * CRITICAL:
 * - Use /live endpoint for real-time matches (status IN (2,3,4,5,7))
 * - Use /detail endpoint for finished matches or when /live returns no data
 * According to TheSports API docs:
 * - /match/trend/live: "Returns home and away team trend details for real-time matches"
 * - Recommended request frequency: 1 minute/time
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
exports.MatchTrendService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var MatchTrendService = /** @class */ (function () {
    function MatchTrendService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Parse trend data from TheSports API format to frontend format
     * API returns: { match_id, trend: { count, per, data: [[first_half_values], [second_half_values]] } }
     * Frontend expects: { match_id, first_half: TrendPoint[], second_half: TrendPoint[] }
     */
    MatchTrendService.prototype.parseTrendData = function (apiResponse, matchId) {
        var _a;
        try {
            // Handle different response formats
            var trendObj = (apiResponse === null || apiResponse === void 0 ? void 0 : apiResponse.trend) || ((_a = apiResponse === null || apiResponse === void 0 ? void 0 : apiResponse.results) === null || _a === void 0 ? void 0 : _a.trend);
            if (!trendObj || !trendObj.data || !Array.isArray(trendObj.data)) {
                return null;
            }
            var data = trendObj.data;
            var firstHalfArray = data[0] || [];
            var secondHalfArray = data[1] || [];
            // Convert arrays to TrendPoint[] format
            // Each value represents the trend value for that minute
            // Positive = home team, Negative = away team
            var firstHalf = firstHalfArray.map(function (value, index) { return ({
                minute: index + 1,
                home_value: value > 0 ? value : 0,
                away_value: value < 0 ? Math.abs(value) : 0,
            }); });
            var secondHalf = secondHalfArray.map(function (value, index) { return ({
                minute: index + 46, // Second half starts at minute 46
                home_value: value > 0 ? value : 0,
                away_value: value < 0 ? Math.abs(value) : 0,
            }); });
            return {
                match_id: matchId,
                first_half: firstHalf,
                second_half: secondHalf,
            };
        }
        catch (error) {
            logger_1.logger.error("Error parsing trend data for ".concat(matchId, ":"), error);
            return null;
        }
    };
    /**
     * Get match trend live (for real-time matches)
     * CRITICAL: Use this endpoint for matches in progress (status IN (2,3,4,5,7))
     * According to TheSports API docs: "Real-time match trends. Returns home and away team trend details for real-time matches"
     */
    MatchTrendService.prototype.getMatchTrendLive = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var match_id, cacheKey, rawResponse, results, parsedResults;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        match_id = params.match_id;
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:trend:live:").concat(match_id);
                        // Don't cache live data - always fetch fresh (cache TTL is very short for live data)
                        logger_1.logger.info("Fetching match trend live: ".concat(match_id));
                        return [4 /*yield*/, this.client.get('/match/trend/live', { match_id: match_id })];
                    case 1:
                        rawResponse = _a.sent();
                        // Parse the response to frontend format
                        // API can return single object or array
                        if (rawResponse === null || rawResponse === void 0 ? void 0 : rawResponse.results) {
                            results = Array.isArray(rawResponse.results) ? rawResponse.results : [rawResponse.results];
                            parsedResults = results
                                .map(function (item) {
                                var parsed = _this.parseTrendData(item, match_id);
                                return parsed;
                            })
                                .filter(function (item) { return item !== null; });
                            if (parsedResults.length > 0) {
                                return [2 /*return*/, {
                                        code: rawResponse.code,
                                        results: parsedResults,
                                        err: rawResponse.err,
                                    }];
                            }
                        }
                        // If parsing fails, return original response
                        return [2 /*return*/, rawResponse];
                }
            });
        });
    };
    /**
     * Get match trend detail (for finished matches or fallback)
     * CRITICAL: Use this endpoint for finished matches or when /live returns no data
     * Request limit: Matches within 30 days before today
     */
    MatchTrendService.prototype.getMatchTrendDetail = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var match_id, cacheKey, cached, results, response, results;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        match_id = params.match_id;
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:trend:detail:").concat(match_id);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _k.sent();
                        // Only use cache if it has actual data (not empty results)
                        if (cached && cached.results && typeof cached.results === 'object' && !Array.isArray(cached.results)) {
                            results = cached.results;
                            if (((_a = results.first_half) === null || _a === void 0 ? void 0 : _a.length) > 0 || ((_b = results.second_half) === null || _b === void 0 ? void 0 : _b.length) > 0 || ((_c = results.overtime) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                                logger_1.logger.debug("Cache hit for match trend detail: ".concat(cacheKey));
                                return [2 /*return*/, cached];
                            }
                        }
                        logger_1.logger.info("Fetching match trend detail: ".concat(match_id));
                        return [4 /*yield*/, this.client.get('/match/trend/detail', { match_id: match_id })];
                    case 2:
                        response = _k.sent();
                        if (!(response && response.results)) return [3 /*break*/, 5];
                        results = Array.isArray(response.results) ? response.results[0] : response.results;
                        if (!(results && typeof results === 'object' && !Array.isArray(results))) return [3 /*break*/, 5];
                        if (!(((_e = (_d = results.first_half) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0) > 0 || ((_g = (_f = results.second_half) === null || _f === void 0 ? void 0 : _f.length) !== null && _g !== void 0 ? _g : 0) > 0 || ((_j = (_h = results.overtime) === null || _h === void 0 ? void 0 : _h.length) !== null && _j !== void 0 ? _j : 0) > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Hour)];
                    case 3:
                        _k.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        logger_1.logger.debug("Trend data not available for match ".concat(match_id, " (empty results)"));
                        _k.label = 5;
                    case 5: return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Get match trend (automatically chooses live or detail based on match status)
     * CRITICAL: For live matches (status IN (2,3,4,5,7)), uses /live endpoint
     * For finished matches, uses /detail endpoint
     *
     * Returns MatchTrendResponse format (normalized) for both endpoints
     */
    MatchTrendService.prototype.getMatchTrend = function (params, matchStatus) {
        return __awaiter(this, void 0, void 0, function () {
            var match_id, liveResponse, normalizedResponse, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        match_id = params.match_id;
                        if (!(matchStatus && [2, 3, 4, 5, 7].includes(matchStatus))) return [3 /*break*/, 4];
                        logger_1.logger.debug("Match ".concat(match_id, " is live (status=").concat(matchStatus, "), using /live endpoint"));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.getMatchTrendLive(params)];
                    case 2:
                        liveResponse = _a.sent();
                        // Check if live response has data
                        // MatchTrendLiveResponse.results is MatchTrendData[] (array)
                        if (liveResponse && liveResponse.results && Array.isArray(liveResponse.results) && liveResponse.results.length > 0) {
                            normalizedResponse = {
                                code: liveResponse.code,
                                results: liveResponse.results[0], // Return first match trend data
                                err: liveResponse.err,
                            };
                            return [2 /*return*/, normalizedResponse];
                        }
                        // If /live returns no data, fallback to /detail
                        logger_1.logger.debug("Match ".concat(match_id, " /live returned no data, falling back to /detail"));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        logger_1.logger.warn("Match ".concat(match_id, " /live failed, falling back to /detail:"), error_1.message);
                        return [3 /*break*/, 4];
                    case 4: return [4 /*yield*/, this.getMatchTrendDetail(params)];
                    case 5: 
                    // Use /detail endpoint for finished matches or as fallback
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return MatchTrendService;
}());
exports.MatchTrendService = MatchTrendService;

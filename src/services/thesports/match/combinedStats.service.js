"use strict";
/**
 * Combined Stats Service
 *
 * Combines data from multiple TheSports API endpoints:
 * 1. /match/detail_live (or /match/live/history for historical) - Basic stats (corner, cards, shots, attacks, possession)
 * 2. /match/team_stats/list (or /detail for historical) - Detailed team stats (passes, tackles, interceptions)
 *
 * This provides comprehensive match statistics similar to AIscore.
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
exports.CombinedStatsService = exports.STAT_TYPE_MAP = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var logger_1 = require("../../../utils/logger");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var matchDetailLive_service_1 = require("./matchDetailLive.service");
var matchTeamStats_service_1 = require("./matchTeamStats.service");
var connection_1 = require("../../../database/connection");
// Stat type mapping for human-readable names
// Based on official TheSports API documentation for detail_live and team_stats
exports.STAT_TYPE_MAP = {
    // Basic stats (detail_live / TechnicalStatistics enum)
    1: { name: 'Goals', nameTr: 'Gol' },
    2: { name: 'Corner Kicks', nameTr: 'Korner' },
    3: { name: 'Yellow Cards', nameTr: 'Sarı Kart' },
    4: { name: 'Red Cards', nameTr: 'Kırmızı Kart' },
    5: { name: 'Offsides', nameTr: 'Ofsayt' },
    6: { name: 'Free Kicks', nameTr: 'Serbest Vuruş' },
    7: { name: 'Goal Kicks', nameTr: 'Aut' },
    8: { name: 'Penalties', nameTr: 'Penaltı' },
    9: { name: 'Substitutions', nameTr: 'Oyuncu Değişikliği' },
    21: { name: 'Shots on Target', nameTr: 'İsabetli Şut' },
    22: { name: 'Shots off Target', nameTr: 'İsabetsiz Şut' },
    23: { name: 'Attacks', nameTr: 'Atak' },
    24: { name: 'Dangerous Attacks', nameTr: 'Tehlikeli Atak' },
    25: { name: 'Ball Possession (%)', nameTr: 'Top Hakimiyeti' },
    37: { name: 'Blocked Shots', nameTr: 'Engellenen Şut' },
    // Detailed stats (team_stats / HalfTimeStatistics enum)
    33: { name: 'Dribbles', nameTr: 'Top Sürme' },
    34: { name: 'Successful Dribbles', nameTr: 'Başarılı Top Sürme' },
    36: { name: 'Clearances', nameTr: 'Uzaklaştırma (Eski)' },
    38: { name: 'Interceptions', nameTr: 'Top Çalma (Eski)' },
    39: { name: 'Tackles', nameTr: 'Müdahale (Eski)' },
    40: { name: 'Total Passes', nameTr: 'Toplam Pas (Eski)' },
    41: { name: 'Accurate Passes', nameTr: 'İsabetli Pas (Eski)' },
    42: { name: 'Key Passes', nameTr: 'Kilit Pas (Eski)' },
    43: { name: 'Crosses', nameTr: 'Orta' },
    44: { name: 'Accurate Crosses', nameTr: 'İsabetli Orta (Eski)' },
    45: { name: 'Long Balls', nameTr: 'Uzun Pas (Eski)' },
    46: { name: 'Accurate Long Balls', nameTr: 'İsabetli Uzun Pas (Eski)' },
    51: { name: 'Fouls', nameTr: 'Faul (Eski)' },
    52: { name: 'Saves', nameTr: 'Kurtarış' },
    69: { name: 'Hit Woodwork', nameTr: 'Direkten Dönen (Eski)' },
    83: { name: 'Total Shots', nameTr: 'Toplam Şut' },
    // Custom Detailed Stats (Mapped from team_stats/list named fields)
    101: { name: 'Total Passes', nameTr: 'Toplam Pas' },
    102: { name: 'Accurate Passes', nameTr: 'İsabetli Pas' },
    103: { name: 'Key Passes', nameTr: 'Kilit Pas' },
    104: { name: 'Accurate Crosses', nameTr: 'İsabetli Orta' },
    105: { name: 'Accurate Long Balls', nameTr: 'İsabetli Uzun Top' },
    106: { name: 'Interceptions', nameTr: 'Top Kesme' },
    107: { name: 'Fouls', nameTr: 'Faul' },
    108: { name: 'Offsides', nameTr: 'Ofsayt' },
    109: { name: 'Fastbreak Shots', nameTr: 'Hızlı Hücum Şutu' },
    110: { name: 'Duels / Tackles', nameTr: 'İkili Mücadele' },
    111: { name: 'Clearances', nameTr: 'Uzaklaştırma' },
    112: { name: 'Successful Dribbles', nameTr: 'Başarılı Çalım' },
    113: { name: 'Duels Won', nameTr: 'Kazanılan İkili Mücadele' },
    115: { name: 'Hit Woodwork', nameTr: 'Direkten Dönen' }
};
// Field mapping for team_stats/list to Custom IDs
var FIELD_TO_ID_MAP = {
    'passes': 101,
    'passes_accuracy': 102,
    'key_passes': 103,
    'crosses_accuracy': 104,
    'long_balls_accuracy': 105,
    'interceptions': 106,
    'fouls': 107,
    'offsides': 108,
    'fastbreak_shots': 109,
    'tackles': 110,
    'clearances': 111,
    'dribble_succ': 112,
    'duels_won': 113,
    'hit_woodwork': 115
};
var CombinedStatsService = /** @class */ (function () {
    function CombinedStatsService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        this.matchDetailLiveService = new matchDetailLive_service_1.MatchDetailLiveService();
        this.matchTeamStatsService = new matchTeamStats_service_1.MatchTeamStatsService();
    }
    /**
     * Get combined match statistics from multiple endpoints
     * Merges basic stats (detail_live) with detailed stats (team_stats)
     */
    CombinedStatsService.prototype.getCombinedMatchStats = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, _a, liveStatsResult, teamStatsResult, basicStats, incidents, score, isLiveStatsFound, liveData, historyData, results, matchData, statsArray, error_1, detailedStats, teamData, results, matchData, basicTypeIds, uniqueDetailedStats, allStats, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:combined_stats:").concat(matchId);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _b.sent();
                        if (cached) {
                            logger_1.logger.debug("Cache hit for combined stats: ".concat(matchId));
                            return [2 /*return*/, cached];
                        }
                        logger_1.logger.info("Fetching combined stats for match: ".concat(matchId));
                        return [4 /*yield*/, Promise.allSettled([
                                this.matchDetailLiveService.getMatchStatsFromLive(matchId),
                                this.matchTeamStatsService.getMatchTeamStats({ match_id: matchId }),
                            ])];
                    case 2:
                        _a = _b.sent(), liveStatsResult = _a[0], teamStatsResult = _a[1];
                        basicStats = [];
                        incidents = [];
                        score = null;
                        isLiveStatsFound = false;
                        if (liveStatsResult.status === 'fulfilled' && liveStatsResult.value) {
                            liveData = liveStatsResult.value;
                            incidents = liveData.incidents || [];
                            score = liveData.score || null;
                            if (Array.isArray(liveData.stats) && liveData.stats.length > 0) {
                                basicStats = liveData.stats.map(function (stat) {
                                    var _a, _b;
                                    var typeInfo = exports.STAT_TYPE_MAP[stat.type] || { name: "Unknown (".concat(stat.type, ")"), nameTr: "Bilinmiyor (".concat(stat.type, ")") };
                                    return {
                                        type: stat.type,
                                        home: (_a = stat.home) !== null && _a !== void 0 ? _a : 0,
                                        away: (_b = stat.away) !== null && _b !== void 0 ? _b : 0,
                                        name: typeInfo.name,
                                        nameTr: typeInfo.nameTr,
                                        source: 'basic',
                                    };
                                });
                                isLiveStatsFound = true;
                            }
                            logger_1.logger.info("Live stats for ".concat(matchId, ": ").concat(basicStats.length, " basic stats, ").concat(incidents.length, " incidents"));
                        }
                        else if (liveStatsResult.status === 'rejected') {
                            logger_1.logger.warn("Failed to fetch live stats for ".concat(matchId, ": ").concat(liveStatsResult.reason));
                        }
                        if (!!isLiveStatsFound) return [3 /*break*/, 6];
                        logger_1.logger.info("No live stats found for ".concat(matchId, ", attempting fallback to historical data"));
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.client.get('/match/live/history', { match_id: matchId })];
                    case 4:
                        historyData = _b.sent();
                        results = (historyData === null || historyData === void 0 ? void 0 : historyData.results) || [];
                        if (Array.isArray(results) && results.length > 0) {
                            matchData = results.find(function (r) { return r.id === matchId || r.match_id === matchId; }) || results[0];
                            // Only overwrite if we don't have them yet
                            if (incidents.length === 0)
                                incidents = (matchData === null || matchData === void 0 ? void 0 : matchData.incidents) || [];
                            if (!score)
                                score = (matchData === null || matchData === void 0 ? void 0 : matchData.score) || null;
                            statsArray = (matchData === null || matchData === void 0 ? void 0 : matchData.stats) || [];
                            if (Array.isArray(statsArray)) {
                                basicStats = statsArray.map(function (stat) {
                                    var _a, _b;
                                    var typeInfo = exports.STAT_TYPE_MAP[stat.type] || { name: "Unknown (".concat(stat.type, ")"), nameTr: "Bilinmiyor (".concat(stat.type, ")") };
                                    return {
                                        type: stat.type,
                                        home: (_a = stat.home) !== null && _a !== void 0 ? _a : 0,
                                        away: (_b = stat.away) !== null && _b !== void 0 ? _b : 0,
                                        name: typeInfo.name,
                                        nameTr: typeInfo.nameTr,
                                        source: 'basic',
                                    };
                                });
                                logger_1.logger.info("Fallback successful: found ".concat(basicStats.length, " basic stats in history for ").concat(matchId));
                            }
                        }
                        else {
                            logger_1.logger.info("No historical data found for ".concat(matchId));
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _b.sent();
                        logger_1.logger.warn("Failed to fetch historical fallback for ".concat(matchId, ": ").concat(error_1));
                        return [3 /*break*/, 6];
                    case 6:
                        detailedStats = [];
                        if (teamStatsResult.status === 'fulfilled' && teamStatsResult.value) {
                            teamData = teamStatsResult.value;
                            results = teamData.results || [];
                            logger_1.logger.info("Raw team stats results count: ".concat(results.length));
                            if (Array.isArray(results) && results.length > 0) {
                                matchData = results.find(function (r) { return r.id === matchId || r.match_id === matchId; });
                                if (matchData) {
                                    logger_1.logger.info("Found match data for ".concat(matchId, ". Keys: ").concat(Object.keys(matchData).join(',')));
                                    // Scenario 2: 'stats' is an array of team objects (Realtime /match/team_stats/list format)
                                    // Check this FIRST because it has a specific structure
                                    if (Array.isArray(matchData.stats) && matchData.stats.length === 2 && matchData.stats[0].team_id) {
                                        detailedStats = this.transformTeamStats(matchData.stats);
                                    }
                                    // Scenario 1: 'stats' is an array of objects (Standard API format)
                                    // Default fallback if not team stats
                                    else if (Array.isArray(matchData.stats)) {
                                        detailedStats = matchData.stats.map(function (stat) {
                                            var _a, _b;
                                            var typeInfo = exports.STAT_TYPE_MAP[stat.type] || { name: "Unknown (".concat(stat.type, ")"), nameTr: "Bilinmiyor (".concat(stat.type, ")") };
                                            return {
                                                type: stat.type,
                                                home: (_a = stat.home) !== null && _a !== void 0 ? _a : 0,
                                                away: (_b = stat.away) !== null && _b !== void 0 ? _b : 0,
                                                name: typeInfo.name,
                                                nameTr: typeInfo.nameTr,
                                                source: 'detailed',
                                            };
                                        });
                                    }
                                }
                                else {
                                    logger_1.logger.warn("[STATS_DEBUG] Match data not found in results for ".concat(matchId));
                                }
                            }
                            logger_1.logger.info("Team stats for ".concat(matchId, ": ").concat(detailedStats.length, " detailed stats"));
                        }
                        else if (teamStatsResult.status === 'rejected') {
                            logger_1.logger.warn("Failed to fetch team stats for ".concat(matchId, ": ").concat(teamStatsResult.reason));
                        }
                        basicTypeIds = new Set(basicStats.map(function (s) { return s.type; }));
                        uniqueDetailedStats = detailedStats.filter(function (s) { return !basicTypeIds.has(s.type); });
                        allStats = __spreadArray(__spreadArray([], basicStats, true), uniqueDetailedStats, true);
                        // Sort by type for consistent ordering
                        allStats.sort(function (a, b) { return a.type - b.type; });
                        result = {
                            matchId: matchId,
                            basicStats: basicStats,
                            detailedStats: detailedStats,
                            allStats: allStats,
                            incidents: incidents,
                            score: score,
                            lastUpdated: Date.now(),
                        };
                        // Cache with short TTL (30 seconds for live matches)
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, result, types_1.CacheTTL.TenSeconds * 3)];
                    case 7:
                        // Cache with short TTL (30 seconds for live matches)
                        _b.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Get historical match statistics (for finished matches)
     * Uses /match/live/history and /match/team_stats/detail endpoints
     */
    CombinedStatsService.prototype.getHistoricalMatchStats = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, _a, historyResult, teamStatsResult, basicStats, incidents, score, historyData, results, matchData, statsArray, detailedStats, teamData, results, matchData, statsArray, basicTypeIds, uniqueDetailedStats, allStats, result;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:historical_stats:").concat(matchId);
                        return [4 /*yield*/, cache_service_1.cacheService.get(cacheKey)];
                    case 1:
                        cached = _c.sent();
                        if (cached) {
                            logger_1.logger.debug("Cache hit for historical stats: ".concat(matchId));
                            return [2 /*return*/, cached];
                        }
                        logger_1.logger.info("Fetching historical stats for match: ".concat(matchId));
                        return [4 /*yield*/, Promise.allSettled([
                                this.client.get('/match/live/history', { match_id: matchId }),
                                this.matchTeamStatsService.getMatchTeamStats({ match_id: matchId }),
                            ])];
                    case 2:
                        _a = _c.sent(), historyResult = _a[0], teamStatsResult = _a[1];
                        basicStats = [];
                        incidents = [];
                        score = null;
                        if (historyResult.status === 'fulfilled' && historyResult.value) {
                            historyData = historyResult.value;
                            results = historyData.results || [];
                            if (Array.isArray(results) && results.length > 0) {
                                matchData = results.find(function (r) { return r.id === matchId || r.match_id === matchId; }) || results[0];
                                incidents = (matchData === null || matchData === void 0 ? void 0 : matchData.incidents) || [];
                                score = (matchData === null || matchData === void 0 ? void 0 : matchData.score) || null;
                                statsArray = (matchData === null || matchData === void 0 ? void 0 : matchData.stats) || [];
                                if (Array.isArray(statsArray)) {
                                    basicStats = statsArray.map(function (stat) {
                                        var _a, _b;
                                        var typeInfo = exports.STAT_TYPE_MAP[stat.type] || { name: "Unknown (".concat(stat.type, ")"), nameTr: "Bilinmiyor (".concat(stat.type, ")") };
                                        return {
                                            type: stat.type,
                                            home: (_a = stat.home) !== null && _a !== void 0 ? _a : 0,
                                            away: (_b = stat.away) !== null && _b !== void 0 ? _b : 0,
                                            name: typeInfo.name,
                                            nameTr: typeInfo.nameTr,
                                            source: 'basic',
                                        };
                                    });
                                }
                            }
                            logger_1.logger.info("Historical stats for ".concat(matchId, ": ").concat(basicStats.length, " basic stats"));
                        }
                        else if (historyResult.status === 'rejected') {
                            logger_1.logger.warn("Failed to fetch historical stats for ".concat(matchId, ": ").concat(historyResult.reason));
                        }
                        detailedStats = [];
                        if (teamStatsResult.status === 'fulfilled' && teamStatsResult.value) {
                            teamData = teamStatsResult.value;
                            results = teamData.results || [];
                            if (Array.isArray(results) && results.length > 0) {
                                matchData = results.find(function (r) { return r.id === matchId || r.match_id === matchId; });
                                statsArray = (matchData === null || matchData === void 0 ? void 0 : matchData.stats) || ((_b = results[0]) === null || _b === void 0 ? void 0 : _b.stats) || [];
                                if (Array.isArray(statsArray)) {
                                    detailedStats = statsArray.map(function (stat) {
                                        var _a, _b;
                                        var typeInfo = exports.STAT_TYPE_MAP[stat.type] || { name: "Unknown (".concat(stat.type, ")"), nameTr: "Bilinmiyor (".concat(stat.type, ")") };
                                        return {
                                            type: stat.type,
                                            home: (_a = stat.home) !== null && _a !== void 0 ? _a : 0,
                                            away: (_b = stat.away) !== null && _b !== void 0 ? _b : 0,
                                            name: typeInfo.name,
                                            nameTr: typeInfo.nameTr,
                                            source: 'detailed',
                                        };
                                    });
                                }
                            }
                        }
                        basicTypeIds = new Set(basicStats.map(function (s) { return s.type; }));
                        uniqueDetailedStats = detailedStats.filter(function (s) { return !basicTypeIds.has(s.type); });
                        allStats = __spreadArray(__spreadArray([], basicStats, true), uniqueDetailedStats, true);
                        allStats.sort(function (a, b) { return a.type - b.type; });
                        result = {
                            matchId: matchId,
                            basicStats: basicStats,
                            detailedStats: detailedStats,
                            allStats: allStats,
                            incidents: incidents,
                            score: score,
                            lastUpdated: Date.now(),
                        };
                        // Cache with longer TTL (5 minutes for historical)
                        return [4 /*yield*/, cache_service_1.cacheService.set(cacheKey, result, types_1.CacheTTL.FiveMinutes)];
                    case 3:
                        // Cache with longer TTL (5 minutes for historical)
                        _c.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Transform named stats from team_stats/list (realtime) into standard stat objects
     */
    CombinedStatsService.prototype.transformTeamStats = function (teamsStats) {
        var homeTeam = teamsStats[0]; // Assuming first team is home (standard behavior)
        var awayTeam = teamsStats[1]; // Assuming second team is away (standard behavior)
        var result = [];
        if (!homeTeam || !awayTeam)
            return result;
        // Iterate through known fields map
        for (var _i = 0, _a = Object.entries(FIELD_TO_ID_MAP); _i < _a.length; _i++) {
            var _b = _a[_i], field = _b[0], typeId = _b[1];
            var homeValue = Number(homeTeam[field]) || 0;
            var awayValue = Number(awayTeam[field]) || 0;
            // Only add if at least one team has non-zero value OR if it's a critical stat
            if (homeValue > 0 || awayValue > 0 || ['passes', 'fouls', 'offsides'].includes(field)) {
                var typeInfo = exports.STAT_TYPE_MAP[typeId] || { name: "Unknown (".concat(typeId, ")"), nameTr: "Bilinmiyor (".concat(typeId, ")") };
                result.push({
                    type: typeId,
                    home: homeValue,
                    away: awayValue,
                    name: typeInfo.name,
                    nameTr: typeInfo.nameTr,
                    source: 'detailed'
                });
            }
        }
        return result;
    };
    /**
     * Save combined match statistics to database (statistics JSONB column)
     * Stores the full combined stats (basic + detailed + half-time) for later retrieval
     * CRITICAL: This saves stats permanently so they survive after match ends
     */
    CombinedStatsService.prototype.saveCombinedStatsToDatabase = function (matchId, stats, halfTimeStats) {
        return __awaiter(this, void 0, void 0, function () {
            var client, columnCheck, existingResult, existingStats, statisticsData, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 6, 7, 8]);
                        return [4 /*yield*/, client.query("\n                SELECT column_name\n                FROM information_schema.columns\n                WHERE table_name = 'ts_matches' \n                AND column_name = 'statistics'\n            ")];
                    case 3:
                        columnCheck = _b.sent();
                        if (columnCheck.rows.length === 0) {
                            logger_1.logger.warn("[CombinedStats] statistics column does not exist, skipping save for ".concat(matchId));
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, client.query("\n                SELECT statistics FROM ts_matches WHERE external_id = $1\n            ", [matchId])];
                    case 4:
                        existingResult = _b.sent();
                        existingStats = ((_a = existingResult.rows[0]) === null || _a === void 0 ? void 0 : _a.statistics) || {};
                        statisticsData = {
                            match_id: stats.matchId,
                            basic_stats: stats.basicStats,
                            detailed_stats: stats.detailedStats,
                            all_stats: stats.allStats,
                            // Preserve or update half-time stats
                            half_time_stats: halfTimeStats || stats.halfTimeStats || existingStats.half_time_stats || null,
                            incidents: stats.incidents,
                            score: stats.score,
                            last_updated: stats.lastUpdated,
                            saved_at: Date.now(),
                        };
                        // Update statistics column
                        return [4 /*yield*/, client.query("\n                UPDATE ts_matches\n                SET statistics = $1::jsonb,\n                    updated_at = NOW()\n                WHERE external_id = $2\n            ", [JSON.stringify(statisticsData), matchId])];
                    case 5:
                        // Update statistics column
                        _b.sent();
                        logger_1.logger.info("[CombinedStats] Saved combined stats to database for match: ".concat(matchId, " (half-time: ").concat(!!statisticsData.half_time_stats, ")"));
                        return [3 /*break*/, 8];
                    case 6:
                        error_2 = _b.sent();
                        logger_1.logger.error("[CombinedStats] Error saving stats to database for ".concat(matchId, ":"), error_2);
                        return [3 /*break*/, 8];
                    case 7:
                        client.release();
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save half-time stats separately (called from half-stats endpoint)
     */
    CombinedStatsService.prototype.saveHalfTimeStatsToDatabase = function (matchId, halfTimeStats) {
        return __awaiter(this, void 0, void 0, function () {
            var client, existingResult, existingStats, statisticsData, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 5, 6, 7]);
                        return [4 /*yield*/, client.query("\n                SELECT statistics FROM ts_matches WHERE external_id = $1\n            ", [matchId])];
                    case 3:
                        existingResult = _b.sent();
                        existingStats = ((_a = existingResult.rows[0]) === null || _a === void 0 ? void 0 : _a.statistics) || {};
                        statisticsData = __assign(__assign({}, existingStats), { half_time_stats: halfTimeStats, last_updated: Date.now(), saved_at: Date.now() });
                        // Update statistics column
                        return [4 /*yield*/, client.query("\n                UPDATE ts_matches\n                SET statistics = $1::jsonb,\n                    updated_at = NOW()\n                WHERE external_id = $2\n            ", [JSON.stringify(statisticsData), matchId])];
                    case 4:
                        // Update statistics column
                        _b.sent();
                        logger_1.logger.info("[CombinedStats] Saved half-time stats to database for match: ".concat(matchId));
                        return [3 /*break*/, 7];
                    case 5:
                        error_3 = _b.sent();
                        logger_1.logger.error("[CombinedStats] Error saving half-time stats to database for ".concat(matchId, ":"), error_3);
                        return [3 /*break*/, 7];
                    case 6:
                        client.release();
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get combined match statistics from database (statistics JSONB column)
     * Returns null if not found or invalid
     */
    CombinedStatsService.prototype.getCombinedStatsFromDatabase = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, statsData, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                SELECT statistics\n                FROM ts_matches\n                WHERE external_id = $1\n                  AND statistics IS NOT NULL\n            ", [matchId])];
                    case 3:
                        result = _a.sent();
                        if (result.rows.length === 0 || !result.rows[0].statistics) {
                            return [2 /*return*/, null];
                        }
                        statsData = result.rows[0].statistics;
                        // Validate structure
                        if (!statsData.all_stats || !Array.isArray(statsData.all_stats)) {
                            logger_1.logger.warn("[CombinedStats] Invalid statistics structure in DB for ".concat(matchId));
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, {
                                matchId: statsData.match_id || matchId,
                                basicStats: statsData.basic_stats || [],
                                detailedStats: statsData.detailed_stats || [],
                                allStats: statsData.all_stats,
                                halfTimeStats: statsData.half_time_stats || undefined,
                                incidents: statsData.incidents || [],
                                score: statsData.score || null,
                                lastUpdated: statsData.last_updated || Date.now(),
                            }];
                    case 4:
                        error_4 = _a.sent();
                        logger_1.logger.error("[CombinedStats] Error reading stats from database for ".concat(matchId, ":"), error_4);
                        return [2 /*return*/, null];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get half-time stats from database
     */
    CombinedStatsService.prototype.getHalfTimeStatsFromDatabase = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                SELECT statistics->'half_time_stats' as half_time_stats\n                FROM ts_matches\n                WHERE external_id = $1\n                  AND statistics->'half_time_stats' IS NOT NULL\n            ", [matchId])];
                    case 3:
                        result = _a.sent();
                        if (result.rows.length === 0 || !result.rows[0].half_time_stats) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, result.rows[0].half_time_stats];
                    case 4:
                        error_5 = _a.sent();
                        logger_1.logger.error("[CombinedStats] Error reading half-time stats from database for ".concat(matchId, ":"), error_5);
                        return [2 /*return*/, null];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if match is finished (status_id = 8)
     */
    CombinedStatsService.prototype.isMatchFinished = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_6;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                SELECT status_id FROM ts_matches WHERE external_id = $1\n            ", [matchId])];
                    case 3:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.status_id) === 8];
                    case 4:
                        error_6 = _b.sent();
                        return [2 /*return*/, false];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save first half stats to database (called when match reaches HALF_TIME status)
     * This is the snapshot of stats at halftime - used to calculate 2nd half stats
     */
    CombinedStatsService.prototype.saveFirstHalfStats = function (matchId, stats) {
        return __awaiter(this, void 0, void 0, function () {
            var client, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                UPDATE ts_matches\n                SET first_half_stats = $1::jsonb,\n                    updated_at = NOW()\n                WHERE external_id = $2\n            ", [JSON.stringify(stats), matchId])];
                    case 3:
                        _a.sent();
                        logger_1.logger.info("[CombinedStats] \u2705 Saved first half stats for match: ".concat(matchId, " (").concat(stats.length, " stats)"));
                        return [3 /*break*/, 6];
                    case 4:
                        error_7 = _a.sent();
                        logger_1.logger.error("[CombinedStats] Error saving first half stats for ".concat(matchId, ":"), error_7);
                        return [3 /*break*/, 6];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get first half stats from database
     */
    CombinedStatsService.prototype.getFirstHalfStats = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                SELECT first_half_stats\n                FROM ts_matches\n                WHERE external_id = $1\n                  AND first_half_stats IS NOT NULL\n            ", [matchId])];
                    case 3:
                        result = _a.sent();
                        if (result.rows.length === 0 || !result.rows[0].first_half_stats) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, result.rows[0].first_half_stats];
                    case 4:
                        error_8 = _a.sent();
                        logger_1.logger.error("[CombinedStats] Error reading first half stats for ".concat(matchId, ":"), error_8);
                        return [2 /*return*/, null];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if first half stats already saved
     */
    CombinedStatsService.prototype.hasFirstHalfStats = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_9;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                SELECT first_half_stats IS NOT NULL as has_stats\n                FROM ts_matches\n                WHERE external_id = $1\n            ", [matchId])];
                    case 3:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.has_stats) === true];
                    case 4:
                        error_9 = _b.sent();
                        return [2 /*return*/, false];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get second half stats from database
     * Returns the statistics_second_half column if it exists
     */
    CombinedStatsService.prototype.getSecondHalfStats = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, colCheck, result, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, 6, 7]);
                        return [4 /*yield*/, client.query("\n                SELECT column_name\n                FROM information_schema.columns\n                WHERE table_name = 'ts_matches'\n                  AND column_name = 'statistics_second_half'\n            ")];
                    case 3:
                        colCheck = _a.sent();
                        if (colCheck.rows.length === 0) {
                            // Column doesn't exist yet
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, client.query("\n                SELECT statistics_second_half\n                FROM ts_matches\n                WHERE external_id = $1\n                  AND statistics_second_half IS NOT NULL\n            ", [matchId])];
                    case 4:
                        result = _a.sent();
                        if (result.rows.length === 0 || !result.rows[0].statistics_second_half) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, result.rows[0].statistics_second_half];
                    case 5:
                        error_10 = _a.sent();
                        logger_1.logger.error("[CombinedStats] Error reading second half stats for ".concat(matchId, ":"), error_10);
                        return [2 /*return*/, null];
                    case 6:
                        client.release();
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get match status from database
     */
    CombinedStatsService.prototype.getMatchStatus = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_11;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _c.sent();
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, 5, 6]);
                        return [4 /*yield*/, client.query("\n                SELECT status_id FROM ts_matches WHERE external_id = $1\n            ", [matchId])];
                    case 3:
                        result = _c.sent();
                        return [2 /*return*/, (_b = (_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.status_id) !== null && _b !== void 0 ? _b : null];
                    case 4:
                        error_11 = _c.sent();
                        return [2 /*return*/, null];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return CombinedStatsService;
}());
exports.CombinedStatsService = CombinedStatsService;

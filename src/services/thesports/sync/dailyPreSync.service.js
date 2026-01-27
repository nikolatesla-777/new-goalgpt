"use strict";
/**
 * Daily Pre-Sync Service
 *
 * Orchestrates pre-sync of all match data before matches start:
 * - H2H data from /match/analysis
 * - Lineups from /match/lineup/detail
 * - Standings from /season/recent/table/detail
 * - Compensation from /compensation/list
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
exports.DailyPreSyncService = void 0;
var TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
var matchAnalysis_service_1 = require("../match/matchAnalysis.service");
var matchLineup_service_1 = require("../match/matchLineup.service");
var standings_service_1 = require("../season/standings.service");
var compensation_service_1 = require("../match/compensation.service");
var tableLive_service_1 = require("../season/tableLive.service");
var logger_1 = require("../../../utils/logger");
var connection_1 = require("../../../database/connection");
var cache_service_1 = require("../../../utils/cache/cache.service");
var types_1 = require("../../../utils/cache/types");
var DailyPreSyncService = /** @class */ (function () {
    function DailyPreSyncService() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
        this.matchAnalysisService = new matchAnalysis_service_1.MatchAnalysisService();
        this.matchLineupService = new matchLineup_service_1.MatchLineupService();
        this.seasonStandingsService = new standings_service_1.SeasonStandingsService();
        this.compensationService = new compensation_service_1.CompensationService();
        this.tableLiveService = new tableLive_service_1.TableLiveService();
    }
    /**
     * Run full pre-sync for today's matches
     * CRITICAL: Uses /compensation/list endpoint for H2H data (optimized batch processing)
     */
    DailyPreSyncService.prototype.runPreSync = function (matchIds, seasonIds) {
        return __awaiter(this, void 0, void 0, function () {
            var result, BATCH_SIZE, compensationMap, page, hasMore, maxPages, compensationResponse, results, _i, results_1, match, i, batch, _a, batch_1, matchId, foundMatch, synced, synced, error_1, error_2, _b, matchIds_1, matchId, synced, err_1, i, batch, _c, batch_2, matchId, synced, error_3, uniqueSeasons, i, batch, _d, batch_3, seasonId, synced, error_4, _e, error_5;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        result = {
                            h2hSynced: 0,
                            lineupsSynced: 0,
                            standingsSynced: 0,
                            compensationSynced: 0,
                            errors: [],
                        };
                        logger_1.logger.info("\uD83D\uDD04 Starting pre-sync for ".concat(matchIds.length, " matches, ").concat(seasonIds.length, " seasons"));
                        BATCH_SIZE = 50;
                        // 1. Sync H2H using compensation/list endpoint (OPTIMIZED: fetch once, match many)
                        logger_1.logger.info("\uD83D\uDD04 [H2H] Fetching compensation/list data for H2H sync...");
                        compensationMap = new Map();
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 19, , 26]);
                        page = 1;
                        hasMore = true;
                        maxPages = 100;
                        _f.label = 2;
                    case 2:
                        if (!(hasMore && page <= maxPages)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.compensationService.getCompensationList(page)];
                    case 3:
                        compensationResponse = _f.sent();
                        results = compensationResponse.results || [];
                        if (results.length === 0) {
                            hasMore = false;
                            return [3 /*break*/, 7];
                        }
                        // Add all matches to map
                        for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                            match = results_1[_i];
                            if (match.id) {
                                compensationMap.set(match.id, match);
                            }
                        }
                        logger_1.logger.info("\uD83D\uDD04 [H2H] Fetched compensation page ".concat(page, ": ").concat(results.length, " matches (total: ").concat(compensationMap.size, ")"));
                        if (!(results.length < 100)) return [3 /*break*/, 4];
                        hasMore = false;
                        return [3 /*break*/, 6];
                    case 4:
                        page++;
                        // Small delay between pages to avoid rate limiting
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 5:
                        // Small delay between pages to avoid rate limiting
                        _f.sent();
                        _f.label = 6;
                    case 6: return [3 /*break*/, 2];
                    case 7:
                        logger_1.logger.info("\u2705 [H2H] Fetched ".concat(compensationMap.size, " matches from compensation/list"));
                        i = 0;
                        _f.label = 8;
                    case 8:
                        if (!(i < matchIds.length)) return [3 /*break*/, 18];
                        batch = matchIds.slice(i, i + BATCH_SIZE);
                        logger_1.logger.info("\uD83D\uDD04 [H2H] Syncing H2H batch ".concat(Math.floor(i / BATCH_SIZE) + 1, "/").concat(Math.ceil(matchIds.length / BATCH_SIZE), " (").concat(batch.length, " matches)"));
                        _a = 0, batch_1 = batch;
                        _f.label = 9;
                    case 9:
                        if (!(_a < batch_1.length)) return [3 /*break*/, 17];
                        matchId = batch_1[_a];
                        _f.label = 10;
                    case 10:
                        _f.trys.push([10, 15, , 16]);
                        foundMatch = compensationMap.get(matchId);
                        if (!foundMatch) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.syncH2HFromCompensationData(matchId, foundMatch)];
                    case 11:
                        synced = _f.sent();
                        if (synced) {
                            result.h2hSynced++;
                        }
                        return [3 /*break*/, 14];
                    case 12:
                        // Not found in compensation/list, try /match/analysis as fallback
                        logger_1.logger.debug("[H2H] Match ".concat(matchId, " not found in compensation/list, trying /match/analysis"));
                        return [4 /*yield*/, this.syncH2HToDb(matchId)];
                    case 13:
                        synced = _f.sent();
                        if (synced) {
                            result.h2hSynced++;
                        }
                        _f.label = 14;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        error_1 = _f.sent();
                        result.errors.push("H2H ".concat(matchId, ": ").concat(error_1.message));
                        return [3 /*break*/, 16];
                    case 16:
                        _a++;
                        return [3 /*break*/, 9];
                    case 17:
                        i += BATCH_SIZE;
                        return [3 /*break*/, 8];
                    case 18: return [3 /*break*/, 26];
                    case 19:
                        error_2 = _f.sent();
                        logger_1.logger.error("\u274C [H2H] Failed to fetch compensation/list: ".concat(error_2.message));
                        result.errors.push("H2H compensation/list fetch: ".concat(error_2.message));
                        // Fallback: Try individual sync for each match
                        logger_1.logger.info("\uD83D\uDD04 [H2H] Falling back to individual match sync...");
                        _b = 0, matchIds_1 = matchIds;
                        _f.label = 20;
                    case 20:
                        if (!(_b < matchIds_1.length)) return [3 /*break*/, 25];
                        matchId = matchIds_1[_b];
                        _f.label = 21;
                    case 21:
                        _f.trys.push([21, 23, , 24]);
                        return [4 /*yield*/, this.syncH2HToDb(matchId)];
                    case 22:
                        synced = _f.sent();
                        if (synced) {
                            result.h2hSynced++;
                        }
                        return [3 /*break*/, 24];
                    case 23:
                        err_1 = _f.sent();
                        result.errors.push("H2H ".concat(matchId, ": ").concat(err_1.message));
                        return [3 /*break*/, 24];
                    case 24:
                        _b++;
                        return [3 /*break*/, 20];
                    case 25: return [3 /*break*/, 26];
                    case 26:
                        i = 0;
                        _f.label = 27;
                    case 27:
                        if (!(i < matchIds.length)) return [3 /*break*/, 36];
                        batch = matchIds.slice(i, i + BATCH_SIZE);
                        logger_1.logger.info("\uD83D\uDD04 Syncing Lineups batch ".concat(Math.floor(i / BATCH_SIZE) + 1, "/").concat(Math.ceil(matchIds.length / BATCH_SIZE), " (").concat(batch.length, " matches)"));
                        _c = 0, batch_2 = batch;
                        _f.label = 28;
                    case 28:
                        if (!(_c < batch_2.length)) return [3 /*break*/, 33];
                        matchId = batch_2[_c];
                        _f.label = 29;
                    case 29:
                        _f.trys.push([29, 31, , 32]);
                        return [4 /*yield*/, this.syncLineupToDb(matchId)];
                    case 30:
                        synced = _f.sent();
                        if (synced) {
                            result.lineupsSynced++;
                        }
                        return [3 /*break*/, 32];
                    case 31:
                        error_3 = _f.sent();
                        result.errors.push("Lineup ".concat(matchId, ": ").concat(error_3.message));
                        return [3 /*break*/, 32];
                    case 32:
                        _c++;
                        return [3 /*break*/, 28];
                    case 33:
                        if (!(i + BATCH_SIZE < matchIds.length)) return [3 /*break*/, 35];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 34:
                        _f.sent();
                        _f.label = 35;
                    case 35:
                        i += BATCH_SIZE;
                        return [3 /*break*/, 27];
                    case 36:
                        uniqueSeasons = __spreadArray([], new Set(seasonIds), true);
                        i = 0;
                        _f.label = 37;
                    case 37:
                        if (!(i < uniqueSeasons.length)) return [3 /*break*/, 46];
                        batch = uniqueSeasons.slice(i, i + BATCH_SIZE);
                        logger_1.logger.info("\uD83D\uDD04 Syncing Standings batch ".concat(Math.floor(i / BATCH_SIZE) + 1, "/").concat(Math.ceil(uniqueSeasons.length / BATCH_SIZE), " (").concat(batch.length, " seasons)"));
                        _d = 0, batch_3 = batch;
                        _f.label = 38;
                    case 38:
                        if (!(_d < batch_3.length)) return [3 /*break*/, 43];
                        seasonId = batch_3[_d];
                        _f.label = 39;
                    case 39:
                        _f.trys.push([39, 41, , 42]);
                        return [4 /*yield*/, this.syncStandingsToDb(seasonId)];
                    case 40:
                        synced = _f.sent();
                        if (synced) {
                            result.standingsSynced++;
                        }
                        return [3 /*break*/, 42];
                    case 41:
                        error_4 = _f.sent();
                        result.errors.push("Standings ".concat(seasonId, ": ").concat(error_4.message));
                        return [3 /*break*/, 42];
                    case 42:
                        _d++;
                        return [3 /*break*/, 38];
                    case 43:
                        if (!(i + BATCH_SIZE < uniqueSeasons.length)) return [3 /*break*/, 45];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 44:
                        _f.sent();
                        _f.label = 45;
                    case 45:
                        i += BATCH_SIZE;
                        return [3 /*break*/, 37];
                    case 46:
                        _f.trys.push([46, 48, , 49]);
                        _e = result;
                        return [4 /*yield*/, this.compensationService.syncAllCompensation()];
                    case 47:
                        _e.compensationSynced = _f.sent();
                        return [3 /*break*/, 49];
                    case 48:
                        error_5 = _f.sent();
                        result.errors.push("Compensation: ".concat(error_5.message));
                        return [3 /*break*/, 49];
                    case 49:
                        logger_1.logger.info("\u2705 Pre-sync complete: H2H=".concat(result.h2hSynced, ", Lineups=").concat(result.lineupsSynced, ", Standings=").concat(result.standingsSynced, ", Compensation=").concat(result.compensationSynced));
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Sync H2H data to database
     * CRITICAL: Uses /compensation/list endpoint which contains H2H data
     * This endpoint returns historical confrontation, recent record, and historical compensation
     * @returns true if data was synced, false if no data available
     */
    DailyPreSyncService.prototype.syncH2HToDb = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var foundMatch, page, maxPages, compensationResponse, cacheKey, response, results, h2hMatches_1, homeRecentForm_1, awayRecentForm_1, goalDistribution_1, history_1, recent, similar, h2hMatches, homeRecentForm, awayRecentForm, goalDistribution, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        logger_1.logger.info("[syncH2HToDb] Starting sync for match ".concat(matchId));
                        foundMatch = null;
                        page = 1;
                        maxPages = 10;
                        _a.label = 1;
                    case 1:
                        if (!(page <= maxPages && !foundMatch)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.compensationService.getCompensationList(page)];
                    case 2:
                        compensationResponse = _a.sent();
                        if (!compensationResponse.results || compensationResponse.results.length === 0) {
                            return [3 /*break*/, 3]; // No more results
                        }
                        foundMatch = compensationResponse.results.find(function (m) { return m.id === matchId; });
                        if (foundMatch) {
                            logger_1.logger.info("[syncH2HToDb] Found match ".concat(matchId, " in compensation/list page ").concat(page));
                            return [3 /*break*/, 3];
                        }
                        // If less than 100 results, we've reached the end
                        if (compensationResponse.results.length < 100) {
                            return [3 /*break*/, 3];
                        }
                        page++;
                        return [3 /*break*/, 1];
                    case 3:
                        if (!!foundMatch) return [3 /*break*/, 7];
                        logger_1.logger.info("[syncH2HToDb] Match ".concat(matchId, " not found in compensation/list, trying /match/analysis as fallback"));
                        cacheKey = "".concat(types_1.CacheKeyPrefix.TheSports, ":match:analysis:").concat(matchId);
                        return [4 /*yield*/, cache_service_1.cacheService.del(cacheKey)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.matchAnalysisService.getMatchAnalysis({ match_id: matchId })];
                    case 5:
                        response = _a.sent();
                        results = response.results || {};
                        if (!results || Object.keys(results).length === 0) {
                            logger_1.logger.warn("[syncH2HToDb] No H2H data for match ".concat(matchId, " - both endpoints returned empty"));
                            return [2 /*return*/, false];
                        }
                        h2hMatches_1 = results.history || results.h2h || [];
                        homeRecentForm_1 = results.home_last || results.home_recent || [];
                        awayRecentForm_1 = results.away_last || results.away_recent || [];
                        goalDistribution_1 = results.goal_distribution || null;
                        return [4 /*yield*/, this.saveH2HToDatabase(matchId, h2hMatches_1, homeRecentForm_1, awayRecentForm_1, goalDistribution_1, response)];
                    case 6: return [2 /*return*/, _a.sent()];
                    case 7:
                        history_1 = foundMatch.history || {};
                        recent = foundMatch.recent || {};
                        similar = foundMatch.similar || {};
                        h2hMatches = [];
                        homeRecentForm = recent.home ? [recent.home] : [];
                        awayRecentForm = recent.away ? [recent.away] : [];
                        goalDistribution = null;
                        logger_1.logger.info("[syncH2HToDb] Parsed data from compensation/list for ".concat(matchId, ": history=").concat(Object.keys(history_1).length > 0 ? 'yes' : 'no', ", recent=").concat(Object.keys(recent).length > 0 ? 'yes' : 'no'));
                        return [4 /*yield*/, this.saveH2HToDatabase(matchId, h2hMatches, homeRecentForm, awayRecentForm, goalDistribution, foundMatch, history_1)];
                    case 8: return [2 /*return*/, _a.sent()];
                    case 9:
                        error_6 = _a.sent();
                        logger_1.logger.error("\u274C Failed to sync H2H for match ".concat(matchId, ": ").concat(error_6.message), error_6);
                        throw error_6;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sync H2H from compensation data (optimized - no API call needed)
     */
    DailyPreSyncService.prototype.syncH2HFromCompensationData = function (matchId, foundMatch) {
        return __awaiter(this, void 0, void 0, function () {
            var history_2, recent, h2hMatches, homeRecentForm, awayRecentForm, goalDistribution, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        history_2 = foundMatch.history || {};
                        recent = foundMatch.recent || {};
                        if (!history_2.home || !history_2.away) {
                            logger_1.logger.debug("[syncH2HFromCompensationData] No history data for ".concat(matchId));
                            return [2 /*return*/, false];
                        }
                        h2hMatches = [];
                        homeRecentForm = recent.home ? [recent.home] : [];
                        awayRecentForm = recent.away ? [recent.away] : [];
                        goalDistribution = null;
                        return [4 /*yield*/, this.saveH2HToDatabase(matchId, h2hMatches, homeRecentForm, awayRecentForm, goalDistribution, foundMatch, history_2)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_7 = _a.sent();
                        logger_1.logger.error("\u274C Failed to sync H2H from compensation data for ".concat(matchId, ": ").concat(error_7.message));
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save H2H data to database (helper method)
     */
    DailyPreSyncService.prototype.saveH2HToDatabase = function (matchId, h2hMatches, homeRecentForm, awayRecentForm, goalDistribution, rawResponse, history) {
        return __awaiter(this, void 0, void 0, function () {
            var totalMatches, homeWins, draws, awayWins, _i, h2hMatches_2, match, homeScore, awayScore, client;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        totalMatches = 0, homeWins = 0, draws = 0, awayWins = 0;
                        if (Array.isArray(h2hMatches) && h2hMatches.length > 0) {
                            // Calculate from individual matches
                            totalMatches = h2hMatches.length;
                            for (_i = 0, h2hMatches_2 = h2hMatches; _i < h2hMatches_2.length; _i++) {
                                match = h2hMatches_2[_i];
                                homeScore = (_b = (_a = match.home_score) !== null && _a !== void 0 ? _a : match.home) !== null && _b !== void 0 ? _b : 0;
                                awayScore = (_d = (_c = match.away_score) !== null && _c !== void 0 ? _c : match.away) !== null && _d !== void 0 ? _d : 0;
                                if (homeScore > awayScore)
                                    homeWins++;
                                else if (homeScore < awayScore)
                                    awayWins++;
                                else
                                    draws++;
                            }
                        }
                        else if (history && history.home && history.away) {
                            // Calculate from compensation/list history object
                            homeWins = history.home.won_count || 0;
                            draws = history.home.drawn_count || 0;
                            awayWins = history.away.won_count || 0;
                            totalMatches = homeWins + draws + awayWins;
                        }
                        if (totalMatches === 0) {
                            logger_1.logger.warn("[syncH2HToDb] No H2H matches found for ".concat(matchId));
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _e.sent();
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, , 4, 5]);
                        return [4 /*yield*/, client.query("\n          INSERT INTO ts_match_h2h (\n            match_id, total_matches, home_wins, draws, away_wins,\n            h2h_matches, home_recent_form, away_recent_form, goal_distribution, raw_response, updated_at\n          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())\n          ON CONFLICT (match_id) DO UPDATE SET\n            total_matches = EXCLUDED.total_matches,\n            home_wins = EXCLUDED.home_wins,\n            draws = EXCLUDED.draws,\n            away_wins = EXCLUDED.away_wins,\n            h2h_matches = EXCLUDED.h2h_matches,\n            home_recent_form = EXCLUDED.home_recent_form,\n            away_recent_form = EXCLUDED.away_recent_form,\n            goal_distribution = EXCLUDED.goal_distribution,\n            raw_response = EXCLUDED.raw_response,\n            updated_at = NOW()\n        ", [
                                matchId, totalMatches, homeWins, draws, awayWins,
                                JSON.stringify(h2hMatches),
                                JSON.stringify(homeRecentForm),
                                JSON.stringify(awayRecentForm),
                                JSON.stringify(goalDistribution),
                                JSON.stringify(rawResponse)
                            ])];
                    case 3:
                        _e.sent();
                        logger_1.logger.info("\u2705 Synced H2H for match ".concat(matchId, ": ").concat(totalMatches, " matches (").concat(homeWins, "H-").concat(draws, "D-").concat(awayWins, "A)"));
                        return [2 /*return*/, true];
                    case 4:
                        client.release();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sync Lineup data to database
     * @returns true if data was synced, false if no data available
     */
    DailyPreSyncService.prototype.syncLineupToDb = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, results, homeFormation, awayFormation, homeLineup, awayLineup, homeSubs, awaySubs, client, error_8;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, this.matchLineupService.getMatchLineup({ match_id: matchId })];
                    case 1:
                        response = _g.sent();
                        results = response.results || {};
                        if (!results || Object.keys(results).length === 0) {
                            logger_1.logger.debug("No lineup data for match ".concat(matchId));
                            return [2 /*return*/, false];
                        }
                        homeFormation = results.home_formation || ((_a = results.home) === null || _a === void 0 ? void 0 : _a.formation) || null;
                        awayFormation = results.away_formation || ((_b = results.away) === null || _b === void 0 ? void 0 : _b.formation) || null;
                        homeLineup = results.home_lineup || ((_c = results.home) === null || _c === void 0 ? void 0 : _c.lineup) || [];
                        awayLineup = results.away_lineup || ((_d = results.away) === null || _d === void 0 ? void 0 : _d.lineup) || [];
                        homeSubs = results.home_subs || ((_e = results.home) === null || _e === void 0 ? void 0 : _e.subs) || [];
                        awaySubs = results.away_subs || ((_f = results.away) === null || _f === void 0 ? void 0 : _f.subs) || [];
                        return [4 /*yield*/, connection_1.pool.connect()];
                    case 2:
                        client = _g.sent();
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, , 5, 6]);
                        return [4 /*yield*/, client.query("\n          INSERT INTO ts_match_lineups (\n            match_id, home_formation, away_formation,\n            home_lineup, away_lineup, home_subs, away_subs, raw_response, updated_at\n          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())\n          ON CONFLICT (match_id) DO UPDATE SET\n            home_formation = EXCLUDED.home_formation,\n            away_formation = EXCLUDED.away_formation,\n            home_lineup = EXCLUDED.home_lineup,\n            away_lineup = EXCLUDED.away_lineup,\n            home_subs = EXCLUDED.home_subs,\n            away_subs = EXCLUDED.away_subs,\n            raw_response = EXCLUDED.raw_response,\n            updated_at = NOW()\n        ", [
                                matchId, homeFormation, awayFormation,
                                JSON.stringify(homeLineup),
                                JSON.stringify(awayLineup),
                                JSON.stringify(homeSubs),
                                JSON.stringify(awaySubs),
                                JSON.stringify(response)
                            ])];
                    case 4:
                        _g.sent();
                        logger_1.logger.debug("\u2705 Synced lineup for match ".concat(matchId));
                        return [2 /*return*/, true];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_8 = _g.sent();
                        logger_1.logger.warn("Failed to sync lineup for match ".concat(matchId, ": ").concat(error_8.message));
                        throw error_8; // Re-throw to be caught by caller
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sync Standings data to database using /table/live endpoint
     * @returns true if data was synced, false if no data available
     */
    DailyPreSyncService.prototype.syncStandingsToDb = function (seasonId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Use tableLiveService which uses /table/live endpoint
                        return [4 /*yield*/, this.tableLiveService.syncStandingsToDb(seasonId)];
                    case 1:
                        // Use tableLiveService which uses /table/live endpoint
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_9 = _a.sent();
                        logger_1.logger.warn("Failed to sync standings for season ".concat(seasonId, ": ").concat(error_9.message));
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get H2H data from database
     */
    DailyPreSyncService.prototype.getH2HFromDb = function (matchId) {
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
                        return [4 /*yield*/, client.query('SELECT * FROM ts_match_h2h WHERE match_id = $1', [matchId])];
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
    /**
     * Get Lineup data from database
     */
    DailyPreSyncService.prototype.getLineupFromDb = function (matchId) {
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
                        return [4 /*yield*/, client.query('SELECT * FROM ts_match_lineups WHERE match_id = $1', [matchId])];
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
    /**
     * Get Standings data from database
     */
    DailyPreSyncService.prototype.getStandingsFromDb = function (seasonId) {
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
                        return [4 /*yield*/, client.query('SELECT * FROM ts_standings WHERE season_id = $1', [seasonId])];
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
    return DailyPreSyncService;
}());
exports.DailyPreSyncService = DailyPreSyncService;

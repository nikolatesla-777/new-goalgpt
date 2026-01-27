"use strict";
/**
 * Stats Sync Job - Phase 6 Implementation
 *
 * Background job to proactively sync match statistics for live matches.
 * Fetches from TheSports API /match/team_stats/list endpoint which returns
 * all stats that changed in the last 120 seconds.
 *
 * Schedule: Every minute (when live matches exist)
 * Data flow: TheSports API → ts_match_stats table → getMatchFull endpoint
 *
 * Benefits:
 * - Stats always fresh in database (no API call needed in getMatchFull)
 * - Single API call fetches ALL live match stats (batch efficiency)
 * - Reduces API latency from user-facing requests
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
exports.runStatsSync = runStatsSync;
exports.getStatsSyncStatus = getStatsSyncStatus;
exports.resetStatsSyncCircuit = resetStatsSyncCircuit;
var TheSportsAPIManager_1 = require("../core/TheSportsAPIManager");
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
var obsLogger_1 = require("../utils/obsLogger");
var matchStats_repository_1 = require("../repositories/matchStats.repository");
var memoryCache_1 = require("../utils/cache/memoryCache");
var MatchState_enum_1 = require("../types/thesports/enums/MatchState.enum");
// Job state tracking
var isRunning = false;
var lastRunTime = null;
var consecutiveErrors = 0;
var MAX_CONSECUTIVE_ERRORS = 5;
/**
 * Stats type mapping from TheSports API
 * API returns array indexed by type: [corner, yellow, red, ...]
 */
var STAT_TYPE_MAP = {
    0: { home: 'home_corner', away: 'away_corner' },
    1: { home: 'home_yellow_cards', away: 'away_yellow_cards' },
    2: { home: 'home_red_cards', away: 'away_red_cards' },
    3: { home: 'home_shots', away: 'away_shots' },
    4: { home: 'home_shots_on_target', away: 'away_shots_on_target' },
    5: { home: 'home_attacks', away: 'away_attacks' },
    6: { home: 'home_dangerous_attacks', away: 'away_dangerous_attacks' },
    7: { home: 'home_possession', away: 'away_possession' },
    8: { home: 'home_passes', away: 'away_passes' },
    9: { home: 'home_accurate_passes', away: 'away_accurate_passes' },
    10: { home: 'home_fouls', away: 'away_fouls' },
    11: { home: 'home_offsides', away: 'away_offsides' },
};
/**
 * Check if there are live matches in database
 * Optimization: Skip API call if no live matches
 */
function hasLiveMatches() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT EXISTS (\n        SELECT 1 FROM ts_matches\n        WHERE status_id IN (".concat(MatchState_enum_1.LIVE_STATUSES_SQL, ")\n        LIMIT 1\n      ) as has_live\n    "))];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.has_live) === true];
                case 2:
                    error_1 = _b.sent();
                    logger_1.logger.warn('[StatsSync] Failed to check live matches, assuming true');
                    return [2 /*return*/, true];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Parse stats from TheSports API format
 * API returns: { id: matchId, stats: [[home_vals], [away_vals]] }
 */
function parseStatsFromApi(apiMatch) {
    var matchId = apiMatch.id || apiMatch.match_id;
    if (!matchId)
        return null;
    var stats = { match_id: matchId };
    // Parse stats array: [[home_vals...], [away_vals...]]
    if (Array.isArray(apiMatch.stats) && apiMatch.stats.length >= 2) {
        var homeStats = apiMatch.stats[0] || [];
        var awayStats = apiMatch.stats[1] || [];
        // Map each stat type to its field
        for (var _i = 0, _a = Object.entries(STAT_TYPE_MAP); _i < _a.length; _i++) {
            var _b = _a[_i], index = _b[0], mapping = _b[1];
            var idx = parseInt(index);
            var map = mapping;
            if (homeStats[idx] !== undefined) {
                stats[map.home] = homeStats[idx];
            }
            if (awayStats[idx] !== undefined) {
                stats[map.away] = awayStats[idx];
            }
        }
    }
    return stats;
}
/**
 * Main sync function
 * Fetches all changed stats from API and saves to database
 */
function runStatsSync() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, hasLive, response, matches, successCount, errorCount, _i, matches_1, apiMatch, stats, success, err_1, duration, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Prevent concurrent runs
                    if (isRunning) {
                        logger_1.logger.debug('[StatsSync] Already running, skipping');
                        return [2 /*return*/];
                    }
                    // Circuit breaker: Stop after too many consecutive errors
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        logger_1.logger.warn("[StatsSync] Circuit breaker open (".concat(consecutiveErrors, " errors), skipping"));
                        return [2 /*return*/];
                    }
                    isRunning = true;
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 11, 12, 13]);
                    return [4 /*yield*/, hasLiveMatches()];
                case 2:
                    hasLive = _a.sent();
                    if (!hasLive) {
                        logger_1.logger.debug('[StatsSync] No live matches, skipping');
                        isRunning = false;
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, TheSportsAPIManager_1.theSportsAPI.get('/match/team_stats/list')];
                case 3:
                    response = _a.sent();
                    if (!(response === null || response === void 0 ? void 0 : response.results) || !Array.isArray(response.results)) {
                        logger_1.logger.debug('[StatsSync] No stats data from API');
                        consecutiveErrors = 0;
                        isRunning = false;
                        return [2 /*return*/];
                    }
                    matches = response.results;
                    successCount = 0;
                    errorCount = 0;
                    _i = 0, matches_1 = matches;
                    _a.label = 4;
                case 4:
                    if (!(_i < matches_1.length)) return [3 /*break*/, 10];
                    apiMatch = matches_1[_i];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 8, , 9]);
                    stats = parseStatsFromApi(apiMatch);
                    if (!(stats && stats.match_id)) return [3 /*break*/, 7];
                    return [4 /*yield*/, matchStats_repository_1.matchStatsRepository.upsertStats(stats)];
                case 6:
                    success = _a.sent();
                    if (success) {
                        successCount++;
                        // Invalidate memory cache for this match
                        memoryCache_1.memoryCache.invalidateMatch(stats.match_id);
                    }
                    else {
                        errorCount++;
                    }
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_1 = _a.sent();
                    errorCount++;
                    logger_1.logger.error("[StatsSync] Error processing match stats:", err_1.message);
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 4];
                case 10:
                    duration = Date.now() - startTime;
                    lastRunTime = new Date();
                    consecutiveErrors = 0;
                    // Log success
                    if (successCount > 0) {
                        logger_1.logger.info("[StatsSync] Synced ".concat(successCount, " match stats in ").concat(duration, "ms (").concat(errorCount, " errors)"));
                        (0, obsLogger_1.logEvent)('info', 'stats_sync.completed', {
                            matches: matches.length,
                            synced: successCount,
                            errors: errorCount,
                            duration_ms: duration,
                        });
                    }
                    else {
                        logger_1.logger.debug("[StatsSync] No stats to sync (".concat(matches.length, " matches checked)"));
                    }
                    return [3 /*break*/, 13];
                case 11:
                    error_2 = _a.sent();
                    consecutiveErrors++;
                    logger_1.logger.error("[StatsSync] Job failed (attempt ".concat(consecutiveErrors, "/").concat(MAX_CONSECUTIVE_ERRORS, "):"), error_2.message);
                    (0, obsLogger_1.logEvent)('error', 'stats_sync.failed', {
                        error: error_2.message,
                        consecutive_errors: consecutiveErrors,
                    });
                    return [3 /*break*/, 13];
                case 12:
                    isRunning = false;
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get job status for monitoring
 */
function getStatsSyncStatus() {
    return {
        isRunning: isRunning,
        lastRunTime: lastRunTime,
        consecutiveErrors: consecutiveErrors,
        circuitOpen: consecutiveErrors >= MAX_CONSECUTIVE_ERRORS,
    };
}
/**
 * Reset circuit breaker (for admin use)
 */
function resetStatsSyncCircuit() {
    consecutiveErrors = 0;
    logger_1.logger.info('[StatsSync] Circuit breaker reset');
}

"use strict";
/**
 * Lineup Pre-Sync Job - Phase 7 Implementation
 *
 * Proactively fetches lineup data for matches starting soon.
 * Ensures lineup tab has data before users open match details.
 *
 * Schedule: Every 15 minutes
 * Target: Matches starting in next 60 minutes that don't have lineup data
 *
 * Benefits:
 * - Lineup always available when match is about to start
 * - No API call needed in getMatchFull for upcoming matches
 * - Retry mechanism for failed fetches
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
exports.runLineupPreSync = runLineupPreSync;
exports.getLineupPreSyncStatus = getLineupPreSyncStatus;
var TheSportsAPIManager_1 = require("../core/TheSportsAPIManager");
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
var obsLogger_1 = require("../utils/obsLogger");
var memoryCache_1 = require("../utils/cache/memoryCache");
// Job state tracking
var isRunning = false;
var lastRunTime = null;
var lastSyncCount = 0;
// Configuration
var MINUTES_BEFORE_MATCH = 60; // Fetch lineups for matches starting in next 60 minutes
var MAX_MATCHES_PER_RUN = 20; // Limit to avoid overwhelming API
var RETRY_DELAY_MS = 2000; // Delay between retries
var MAX_RETRIES = 2; // Max retries per match
/**
 * Parse lineup data from TheSports API response
 */
function parseLineupData(apiResponse) {
    var results = apiResponse === null || apiResponse === void 0 ? void 0 : apiResponse.results;
    if (!results)
        return null;
    // Handle array or object format
    var data = Array.isArray(results) ? results[0] : results;
    if (!data)
        return null;
    return {
        home: data.home || data.home_lineup || [],
        away: data.away || data.away_lineup || [],
        home_formation: data.home_formation || null,
        away_formation: data.away_formation || null,
    };
}
/**
 * Fetch lineup for a single match with retry
 */
function fetchLineupWithRetry(matchId_1) {
    return __awaiter(this, arguments, void 0, function (matchId, retries) {
        var response, lineup, error_1;
        if (retries === void 0) { retries = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 6]);
                    return [4 /*yield*/, TheSportsAPIManager_1.theSportsAPI.get('/match/lineup/detail', { match_id: matchId })];
                case 1:
                    response = _a.sent();
                    lineup = parseLineupData(response);
                    if (!lineup || (lineup.home.length === 0 && lineup.away.length === 0)) {
                        logger_1.logger.debug("[LineupPreSync] No lineup data available for ".concat(matchId));
                        return [2 /*return*/, false];
                    }
                    // Save to database
                    return [4 /*yield*/, connection_1.pool.query("\n      UPDATE ts_matches\n      SET\n        lineup_data = $2::jsonb,\n        home_formation = $3,\n        away_formation = $4,\n        updated_at = NOW()\n      WHERE external_id = $1\n    ", [
                            matchId,
                            JSON.stringify({ home: lineup.home, away: lineup.away }),
                            lineup.home_formation,
                            lineup.away_formation,
                        ])];
                case 2:
                    // Save to database
                    _a.sent();
                    // Invalidate memory cache
                    memoryCache_1.memoryCache.invalidateMatch(matchId);
                    logger_1.logger.info("[LineupPreSync] \u2713 Synced lineup for ".concat(matchId, " (").concat(lineup.home.length, "H + ").concat(lineup.away.length, "A players)"));
                    return [2 /*return*/, true];
                case 3:
                    error_1 = _a.sent();
                    if (!(retries < MAX_RETRIES)) return [3 /*break*/, 5];
                    logger_1.logger.warn("[LineupPreSync] Retry ".concat(retries + 1, "/").concat(MAX_RETRIES, " for ").concat(matchId, ": ").concat(error_1.message));
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY_MS); })];
                case 4:
                    _a.sent();
                    return [2 /*return*/, fetchLineupWithRetry(matchId, retries + 1)];
                case 5:
                    logger_1.logger.error("[LineupPreSync] Failed to fetch lineup for ".concat(matchId, " after ").concat(MAX_RETRIES, " retries: ").concat(error_1.message));
                    return [2 /*return*/, false];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get matches starting soon without lineup data
 */
function getMatchesNeedingLineup() {
    return __awaiter(this, void 0, void 0, function () {
        var nowTs, futureTs, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    nowTs = Math.floor(Date.now() / 1000);
                    futureTs = nowTs + (MINUTES_BEFORE_MATCH * 60);
                    return [4 /*yield*/, connection_1.pool.query("\n    SELECT external_id, match_time\n    FROM ts_matches\n    WHERE status_id = 1\n      AND match_time >= $1\n      AND match_time <= $2\n      AND (lineup_data IS NULL OR lineup_data = '{}' OR lineup_data = 'null')\n    ORDER BY match_time ASC\n    LIMIT $3\n  ", [nowTs, futureTs, MAX_MATCHES_PER_RUN])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows];
            }
        });
    });
}
/**
 * Main sync function
 */
function runLineupPreSync() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, matches, successCount, failCount, _i, matches_1, match, minutesUntilStart, success, duration, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isRunning) {
                        logger_1.logger.debug('[LineupPreSync] Already running, skipping');
                        return [2 /*return*/];
                    }
                    isRunning = true;
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, 9, 10]);
                    return [4 /*yield*/, getMatchesNeedingLineup()];
                case 2:
                    matches = _a.sent();
                    if (matches.length === 0) {
                        logger_1.logger.debug('[LineupPreSync] No matches need lineup sync');
                        isRunning = false;
                        return [2 /*return*/];
                    }
                    logger_1.logger.info("[LineupPreSync] Found ".concat(matches.length, " matches starting in next ").concat(MINUTES_BEFORE_MATCH, " minutes without lineup"));
                    successCount = 0;
                    failCount = 0;
                    _i = 0, matches_1 = matches;
                    _a.label = 3;
                case 3:
                    if (!(_i < matches_1.length)) return [3 /*break*/, 7];
                    match = matches_1[_i];
                    minutesUntilStart = Math.round((match.match_time - Date.now() / 1000) / 60);
                    logger_1.logger.debug("[LineupPreSync] Processing ".concat(match.external_id, " (starts in ").concat(minutesUntilStart, " min)"));
                    return [4 /*yield*/, fetchLineupWithRetry(match.external_id)];
                case 4:
                    success = _a.sent();
                    if (success) {
                        successCount++;
                    }
                    else {
                        failCount++;
                    }
                    // Small delay between API calls
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 5:
                    // Small delay between API calls
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7:
                    duration = Date.now() - startTime;
                    lastRunTime = new Date();
                    lastSyncCount = successCount;
                    logger_1.logger.info("[LineupPreSync] Completed: ".concat(successCount, " synced, ").concat(failCount, " failed (").concat(duration, "ms)"));
                    if (successCount > 0) {
                        (0, obsLogger_1.logEvent)('info', 'lineup_presync.completed', {
                            matches: matches.length,
                            synced: successCount,
                            failed: failCount,
                            duration_ms: duration,
                        });
                    }
                    return [3 /*break*/, 10];
                case 8:
                    error_2 = _a.sent();
                    logger_1.logger.error('[LineupPreSync] Job failed:', error_2.message);
                    (0, obsLogger_1.logEvent)('error', 'lineup_presync.failed', { error: error_2.message });
                    return [3 /*break*/, 10];
                case 9:
                    isRunning = false;
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get job status for monitoring
 */
function getLineupPreSyncStatus() {
    return {
        isRunning: isRunning,
        lastRunTime: lastRunTime,
        lastSyncCount: lastSyncCount,
    };
}

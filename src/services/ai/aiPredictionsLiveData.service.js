"use strict";
/**
 * AI Predictions Live Data Service
 *
 * Fetches live match data from TheSports detail_live endpoint
 * Specifically for AI Predictions page - no import conflicts
 *
 * Uses 2-second cache as recommended by TheSports API
 * FIXED: Added timeout and error handling to prevent endpoint hanging
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
exports.calculateMatchMinute = calculateMatchMinute;
exports.getMatchDetailLive = getMatchDetailLive;
exports.getMatchesDetailLive = getMatchesDetailLive;
exports.clearCache = clearCache;
exports.cleanupExpiredCache = cleanupExpiredCache;
var TheSportsAPIManager_1 = require("../../core/TheSportsAPIManager");
var logger_1 = require("../../utils/logger");
/**
 * Parse raw TheSports detail_live response to our expected format
 * Score array format: [match_id, status_id, home_score_array, away_score_array, timestamp, ...]
 * Score arrays: [regular, extra_time, penalty, ..., total] - we use position 4 for total
 */
function parseDetailLiveMatch(raw) {
    if (!raw.score || !Array.isArray(raw.score) || raw.score.length < 5) {
        logger_1.logger.warn("[AIPredictionsLiveData] Invalid score format for match ".concat(raw.id));
        return null;
    }
    var statusId = raw.score[1];
    var homeScoreArray = raw.score[2];
    var awayScoreArray = raw.score[3];
    var timestamp = raw.score[4];
    // Extract total goals from position 4 in score arrays
    var homeScore = Array.isArray(homeScoreArray) && homeScoreArray.length > 4 ? homeScoreArray[4] : 0;
    var awayScore = Array.isArray(awayScoreArray) && awayScoreArray.length > 4 ? awayScoreArray[4] : 0;
    return {
        id: raw.id,
        status_id: statusId,
        minute: null, // Will be calculated using kickoff timestamps
        home_score_display: homeScore,
        away_score_display: awayScore,
        first_half_kickoff_ts: null, // Not available in this endpoint
        second_half_kickoff_ts: null, // Not available in this endpoint
    };
}
// In-memory cache with 30-second TTL (prevents memory overflow from 191 match responses)
var cache = new Map();
var CACHE_TTL_MS = 30000; // 30 seconds (TheSports recommends 2s, but we fetch ALL matches so need longer cache)
var API_TIMEOUT_MS = 5000; // 5 seconds timeout (balance between speed and reliability)
var MAX_CACHE_SIZE = 500; // Prevent unbounded cache growth
/**
 * Promise with timeout wrapper
 */
function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise(function (_, reject) {
            return setTimeout(function () { return reject(new Error("Timeout after ".concat(timeoutMs, "ms"))); }, timeoutMs);
        })
    ]);
}
/**
 * Calculate match minute using kickoff timestamps
 * Formula from TheSports API docs:
 * - First half: (current_ts - first_half_kickoff_ts) / 60 + 1
 * - Second half: (current_ts - second_half_kickoff_ts) / 60 + 45 + 1
 */
function calculateMatchMinute(statusId, firstHalfKickoffTs, secondHalfKickoffTs) {
    var nowTs = Math.floor(Date.now() / 1000);
    // Status 2 = First Half
    if (statusId === 2 && firstHalfKickoffTs) {
        var elapsed = nowTs - firstHalfKickoffTs;
        return Math.floor(elapsed / 60) + 1;
    }
    // Status 4 = Second Half, Status 5 = Overtime
    if ((statusId === 4 || statusId === 5) && secondHalfKickoffTs) {
        var elapsed = nowTs - secondHalfKickoffTs;
        return Math.floor(elapsed / 60) + 45 + 1;
    }
    return null;
}
/**
 * Get live data for a single match
 */
function getMatchDetailLive(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var cached, response, rawMatch, match, error_1, errorMsg;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    cached = cache.get(matchId);
                    if (cached && Date.now() < cached.expiry) {
                        return [2 /*return*/, cached.data];
                    }
                    return [4 /*yield*/, withTimeout(TheSportsAPIManager_1.theSportsAPI.get('/match/detail_live', {
                            match_id: matchId,
                        }), API_TIMEOUT_MS)];
                case 1:
                    response = _b.sent();
                    rawMatch = (_a = response.results) === null || _a === void 0 ? void 0 : _a[0];
                    match = rawMatch ? parseDetailLiveMatch(rawMatch) : null;
                    // Cache result (even if null)
                    cache.set(matchId, {
                        data: match,
                        expiry: Date.now() + CACHE_TTL_MS,
                    });
                    enforceCacheSizeLimit();
                    return [2 /*return*/, match];
                case 2:
                    error_1 = _b.sent();
                    errorMsg = error_1.message || 'Unknown error';
                    logger_1.logger.warn("[AIPredictionsLiveData] Failed to fetch match ".concat(matchId, ": ").concat(errorMsg));
                    // Cache null result to prevent repeated failed attempts
                    cache.set(matchId, {
                        data: null,
                        expiry: Date.now() + CACHE_TTL_MS,
                    });
                    enforceCacheSizeLimit();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get live data for multiple matches (batch)
 * Returns a Map of matchId -> DetailLiveMatch
 *
 * CRITICAL: Non-blocking - if API fails, returns empty Map and logs warning
 */
function getMatchesDetailLive(matchIds) {
    return __awaiter(this, void 0, void 0, function () {
        var result, uncached, now, _i, matchIds_1, matchId, cached, successCount, failCount, response, liveMatchesMap, _a, _b, rawMatch, parsed, _c, uncached_1, matchId, match, error_2, errorMsg, error_3, errorMsg;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    result = new Map();
                    if (matchIds.length === 0) {
                        return [2 /*return*/, result];
                    }
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, , 7]);
                    uncached = [];
                    now = Date.now();
                    for (_i = 0, matchIds_1 = matchIds; _i < matchIds_1.length; _i++) {
                        matchId = matchIds_1[_i];
                        cached = cache.get(matchId);
                        if (cached && now < cached.expiry && cached.data) {
                            result.set(matchId, cached.data);
                        }
                        else {
                            uncached.push(matchId);
                        }
                    }
                    // If all cached, return early
                    if (uncached.length === 0) {
                        return [2 /*return*/, result];
                    }
                    logger_1.logger.debug("[AIPredictionsLiveData] Fetching ".concat(uncached.length, " matches (").concat(matchIds.length, " total, ").concat(result.size, " cached)"));
                    successCount = 0;
                    failCount = 0;
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, withTimeout(TheSportsAPIManager_1.theSportsAPI.get('/match/detail_live'), API_TIMEOUT_MS)];
                case 3:
                    response = _d.sent();
                    if (response.results && Array.isArray(response.results)) {
                        logger_1.logger.debug("[AIPredictionsLiveData] Received ".concat(response.results.length, " live matches from API"));
                        liveMatchesMap = new Map();
                        for (_a = 0, _b = response.results; _a < _b.length; _a++) {
                            rawMatch = _b[_a];
                            parsed = parseDetailLiveMatch(rawMatch);
                            if (parsed) {
                                liveMatchesMap.set(parsed.id, parsed);
                            }
                        }
                        logger_1.logger.debug("[AIPredictionsLiveData] Successfully parsed ".concat(liveMatchesMap.size, " matches"));
                        // Find our requested matches in the response
                        for (_c = 0, uncached_1 = uncached; _c < uncached_1.length; _c++) {
                            matchId = uncached_1[_c];
                            match = liveMatchesMap.get(matchId);
                            if (match) {
                                result.set(match.id, match);
                                // Cache it
                                cache.set(match.id, {
                                    data: match,
                                    expiry: now + CACHE_TTL_MS,
                                });
                                successCount++;
                            }
                            else {
                                // Cache null for not found
                                cache.set(matchId, {
                                    data: null,
                                    expiry: now + CACHE_TTL_MS,
                                });
                                failCount++;
                            }
                        }
                        // Enforce cache size limit after batch insert
                        enforceCacheSizeLimit();
                    }
                    if (successCount > 0) {
                        logger_1.logger.debug("[AIPredictionsLiveData] Successfully fetched ".concat(successCount, "/").concat(uncached.length, " matches"));
                    }
                    if (failCount > 0) {
                        logger_1.logger.debug("[AIPredictionsLiveData] ".concat(failCount, "/").concat(uncached.length, " matches not found in live feed"));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _d.sent();
                    errorMsg = error_2.message || 'Unknown error';
                    logger_1.logger.warn("[AIPredictionsLiveData] Failed to fetch live matches: ".concat(errorMsg));
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, result];
                case 6:
                    error_3 = _d.sent();
                    errorMsg = error_3.message || 'Unknown error';
                    logger_1.logger.warn("[AIPredictionsLiveData] Batch fetch failed (".concat(matchIds.length, " matches): ").concat(errorMsg));
                    // CRITICAL: Return partial results instead of throwing
                    // This prevents the entire endpoint from failing
                    return [2 /*return*/, result];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Clear cache (for testing or manual refresh)
 */
function clearCache() {
    cache.clear();
    logger_1.logger.debug('[AIPredictionsLiveData] Cache cleared');
}
/**
 * Cleanup expired cache entries (called periodically)
 */
function cleanupExpiredCache() {
    var now = Date.now();
    var cleaned = 0;
    for (var _i = 0, _a = cache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (now >= value.expiry) {
            cache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger_1.logger.debug("[AIPredictionsLiveData] Cleaned ".concat(cleaned, " expired cache entries"));
    }
}
/**
 * Enforce cache size limit by removing oldest entries
 */
function enforceCacheSizeLimit() {
    if (cache.size <= MAX_CACHE_SIZE) {
        return;
    }
    // Sort by expiry time and remove oldest entries
    var entries = Array.from(cache.entries());
    entries.sort(function (a, b) { return a[1].expiry - b[1].expiry; });
    var toRemove = cache.size - MAX_CACHE_SIZE;
    for (var i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
    }
    logger_1.logger.warn("[AIPredictionsLiveData] Cache size limit reached, removed ".concat(toRemove, " oldest entries"));
}
// Auto-cleanup every 10 seconds
setInterval(cleanupExpiredCache, 10000);

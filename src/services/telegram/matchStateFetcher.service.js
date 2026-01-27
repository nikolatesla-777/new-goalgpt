"use strict";
/**
 * PHASE-2B-B1: Match State Fetcher Service
 *
 * Purpose: Fetch accurate match state with TheSports API as PRIMARY source
 *
 * Strategy:
 * - PRIMARY: TheSports API /match endpoint (real-time data)
 * - FALLBACK: Database ts_matches table (stale data)
 * - Circuit Breaker: 5 consecutive API failures → 60s DB-only mode
 * - Rate Limit: 429 response → count as breaker failure
 *
 * Guarantees:
 * - Always returns status_id (API or DB)
 * - Logs source for observability
 * - Minimal latency (<1500ms)
 *
 * @author GoalGPT Team
 * @version 1.0.0 - PHASE-2B-B1
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
exports.fetchMatchStateForPublish = fetchMatchStateForPublish;
exports.clearMatchStateCache = clearMatchStateCache;
exports.getMatchStateCacheStats = getMatchStateCacheStats;
exports.getCircuitBreakerStatus = getCircuitBreakerStatus;
exports.resetCircuitBreaker = resetCircuitBreaker;
var connection_1 = require("../../database/connection");
var TheSportsClient_1 = require("../../integrations/thesports/TheSportsClient");
var logger_1 = require("../../utils/logger");
var circuitBreaker = {
    consecutiveFailures: 0,
    lastFailureTime: 0,
    isOpen: false,
};
var BREAKER_THRESHOLD = 5; // 5 consecutive failures
var BREAKER_COOLDOWN_MS = 60000; // 60 seconds
var API_TIMEOUT_MS = 1500; // 1.5 seconds (fast)
var CACHE_TTL_MS = 30000; // 30 seconds
var matchStateCache = new Map();
/**
 * Clear expired cache entries (runs periodically)
 */
function cleanExpiredCache() {
    var now = Date.now();
    for (var _i = 0, _a = matchStateCache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], matchId = _b[0], entry = _b[1];
        if (now - entry.timestamp > CACHE_TTL_MS) {
            matchStateCache.delete(matchId);
        }
    }
}
// Clean cache every 60 seconds
setInterval(cleanExpiredCache, 60000);
// ============================================================================
// CIRCUIT BREAKER LOGIC
// ============================================================================
/**
 * Check if circuit breaker is currently open
 */
function isCircuitBreakerOpen() {
    if (!circuitBreaker.isOpen) {
        return false;
    }
    // Check if cooldown period has passed
    var timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
    if (timeSinceLastFailure >= BREAKER_COOLDOWN_MS) {
        // Reset circuit breaker
        logger_1.logger.info('[MatchStateFetcher] 🔓 Circuit breaker CLOSED (cooldown expired)', {
            cooldown_ms: BREAKER_COOLDOWN_MS,
            time_since_last_failure: timeSinceLastFailure,
        });
        circuitBreaker.isOpen = false;
        circuitBreaker.consecutiveFailures = 0;
        return false;
    }
    return true;
}
/**
 * Record API failure for circuit breaker
 */
function recordApiFailure() {
    circuitBreaker.consecutiveFailures++;
    circuitBreaker.lastFailureTime = Date.now();
    if (circuitBreaker.consecutiveFailures >= BREAKER_THRESHOLD) {
        circuitBreaker.isOpen = true;
        logger_1.logger.warn('[MatchStateFetcher] 🔒 Circuit breaker OPENED (too many failures)', {
            consecutive_failures: circuitBreaker.consecutiveFailures,
            threshold: BREAKER_THRESHOLD,
            cooldown_ms: BREAKER_COOLDOWN_MS,
        });
    }
    else {
        logger_1.logger.warn('[MatchStateFetcher] ⚠️ API failure recorded', {
            consecutive_failures: circuitBreaker.consecutiveFailures,
            threshold: BREAKER_THRESHOLD,
        });
    }
}
/**
 * Record API success (resets circuit breaker)
 */
function recordApiSuccess() {
    if (circuitBreaker.consecutiveFailures > 0) {
        logger_1.logger.info('[MatchStateFetcher] ✅ API success (resetting breaker)', {
            previous_failures: circuitBreaker.consecutiveFailures,
        });
        circuitBreaker.consecutiveFailures = 0;
        circuitBreaker.isOpen = false;
    }
}
// ============================================================================
// CORE FUNCTIONS
// ============================================================================
/**
 * Fetch match state from TheSports API (PRIMARY source)
 */
function fetchFromApi(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, response, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = new TheSportsClient_1.TheSportsClient();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.get('/match', { match_id: matchId }, { timeoutMs: API_TIMEOUT_MS })];
                case 2:
                    response = _b.sent();
                    if (response && typeof response.status_id === 'number') {
                        logger_1.logger.info('[MatchStateFetcher] ✅ Fetched from API', {
                            match_id: matchId,
                            status_id: response.status_id,
                        });
                        return [2 /*return*/, response.status_id];
                    }
                    // Response missing status_id
                    throw new Error('API response missing status_id');
                case 3:
                    error_1 = _b.sent();
                    // Check for rate limit (429)
                    if (((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _a === void 0 ? void 0 : _a.includes('429')) || (error_1 === null || error_1 === void 0 ? void 0 : error_1.statusCode) === 429) {
                        logger_1.logger.warn('[MatchStateFetcher] ⚠️ Rate limit (429) - counting as breaker failure', {
                            match_id: matchId,
                        });
                    }
                    logger_1.logger.error('[MatchStateFetcher] ❌ API fetch failed', {
                        match_id: matchId,
                        error: error_1 instanceof Error ? error_1.message : String(error_1),
                    });
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch match state from Database (FALLBACK source)
 */
function fetchFromDb(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var result, statusId, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection_1.pool.query('SELECT status_id FROM ts_matches WHERE external_id = $1 LIMIT 1', [matchId])];
                case 1:
                    result = _a.sent();
                    if (result.rows.length === 0) {
                        throw new Error('Match not found in database');
                    }
                    statusId = result.rows[0].status_id;
                    if (statusId === null || statusId === undefined) {
                        throw new Error('Database status_id is null');
                    }
                    logger_1.logger.info('[MatchStateFetcher] ✅ Fetched from DB (fallback)', {
                        match_id: matchId,
                        status_id: statusId,
                    });
                    return [2 /*return*/, statusId];
                case 2:
                    error_2 = _a.sent();
                    logger_1.logger.error('[MatchStateFetcher] ❌ DB fetch failed', {
                        match_id: matchId,
                        error: error_2 instanceof Error ? error_2.message : String(error_2),
                    });
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * PHASE-2B-B1: Primary function to get match state for publishing
 *
 * Strategy:
 * 1. Check cache (30s TTL)
 * 2. If circuit breaker OPEN → skip API, use DB
 * 3. Try TheSports API (1500ms timeout)
 * 4. On API failure → fallback to DB
 * 5. Cache result for 30s
 *
 * @param matchId - TheSports external match ID
 * @returns Match state result with source tracking
 * @throws Error if both API and DB fail
 */
function fetchMatchStateForPublish(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, logContext, cached, age, latencyMs, statusId, latencyMs, dbError_1, statusId, latencyMs, apiError_1, statusId, latencyMs, dbError_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    logContext = { match_id: matchId };
                    logger_1.logger.info('[MatchStateFetcher] 🔍 Fetching match state...', logContext);
                    cached = matchStateCache.get(matchId);
                    if (cached) {
                        age = Date.now() - cached.timestamp;
                        if (age < CACHE_TTL_MS) {
                            latencyMs = Date.now() - startTime;
                            logger_1.logger.info('[MatchStateFetcher] 💾 Cache HIT', __assign(__assign({}, logContext), { status_id: cached.statusId, source: cached.source, cache_age_ms: age, latency_ms: latencyMs }));
                            return [2 /*return*/, {
                                    statusId: cached.statusId,
                                    source: cached.source,
                                    isFallback: cached.source === 'db_fallback',
                                    latencyMs: latencyMs,
                                    cached: true,
                                }];
                        }
                        else {
                            // Expired cache entry
                            matchStateCache.delete(matchId);
                        }
                    }
                    if (!isCircuitBreakerOpen()) return [3 /*break*/, 4];
                    logger_1.logger.warn('[MatchStateFetcher] 🔒 Circuit breaker OPEN - using DB fallback', logContext);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetchFromDb(matchId)];
                case 2:
                    statusId = _a.sent();
                    latencyMs = Date.now() - startTime;
                    // Cache DB result
                    matchStateCache.set(matchId, {
                        statusId: statusId,
                        source: 'db_fallback',
                        timestamp: Date.now(),
                    });
                    return [2 /*return*/, {
                            statusId: statusId,
                            source: 'db_fallback',
                            isFallback: true,
                            latencyMs: latencyMs,
                            cached: false,
                        }];
                case 3:
                    dbError_1 = _a.sent();
                    throw new Error("Circuit breaker open + DB fallback failed: ".concat(dbError_1));
                case 4:
                    _a.trys.push([4, 6, , 11]);
                    return [4 /*yield*/, fetchFromApi(matchId)];
                case 5:
                    statusId = _a.sent();
                    recordApiSuccess(); // Reset breaker on success
                    latencyMs = Date.now() - startTime;
                    // Cache API result
                    matchStateCache.set(matchId, {
                        statusId: statusId,
                        source: 'thesports_api',
                        timestamp: Date.now(),
                    });
                    logger_1.logger.info('[MatchStateFetcher] ✅ Match state fetched from API', __assign(__assign({}, logContext), { status_id: statusId, source: 'thesports_api', latency_ms: latencyMs }));
                    return [2 /*return*/, {
                            statusId: statusId,
                            source: 'thesports_api',
                            isFallback: false,
                            latencyMs: latencyMs,
                            cached: false,
                        }];
                case 6:
                    apiError_1 = _a.sent();
                    // API failed - record failure and try DB fallback
                    recordApiFailure();
                    logger_1.logger.warn('[MatchStateFetcher] ⚠️ API failed - trying DB fallback', __assign(__assign({}, logContext), { api_error: apiError_1 instanceof Error ? apiError_1.message : String(apiError_1) }));
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, fetchFromDb(matchId)];
                case 8:
                    statusId = _a.sent();
                    latencyMs = Date.now() - startTime;
                    // Cache DB result
                    matchStateCache.set(matchId, {
                        statusId: statusId,
                        source: 'db_fallback',
                        timestamp: Date.now(),
                    });
                    logger_1.logger.info('[MatchStateFetcher] ✅ Match state fetched from DB (fallback)', __assign(__assign({}, logContext), { status_id: statusId, source: 'db_fallback', latency_ms: latencyMs }));
                    return [2 /*return*/, {
                            statusId: statusId,
                            source: 'db_fallback',
                            isFallback: true,
                            latencyMs: latencyMs,
                            cached: false,
                        }];
                case 9:
                    dbError_2 = _a.sent();
                    // Both API and DB failed
                    logger_1.logger.error('[MatchStateFetcher] ❌ Both API and DB failed', __assign(__assign({}, logContext), { api_error: apiError_1 instanceof Error ? apiError_1.message : String(apiError_1), db_error: dbError_2 instanceof Error ? dbError_2.message : String(dbError_2) }));
                    throw new Error("Failed to fetch match state from both API and DB. API: ".concat(apiError_1, ", DB: ").concat(dbError_2));
                case 10: return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Clear match state cache (for testing)
 */
function clearMatchStateCache() {
    matchStateCache.clear();
    logger_1.logger.info('[MatchStateFetcher] 🧹 Cache cleared');
}
/**
 * Get cache statistics (for monitoring)
 */
function getMatchStateCacheStats() {
    return {
        size: matchStateCache.size,
        entries: Array.from(matchStateCache.keys()),
    };
}
/**
 * Get circuit breaker status (for monitoring)
 */
function getCircuitBreakerStatus() {
    return __assign({}, circuitBreaker);
}
/**
 * Reset circuit breaker (for testing)
 */
function resetCircuitBreaker() {
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.lastFailureTime = 0;
    circuitBreaker.isOpen = false;
    logger_1.logger.info('[MatchStateFetcher] 🔄 Circuit breaker reset');
}

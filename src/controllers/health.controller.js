"use strict";
/**
 * Health Controller
 *
 * Provides health and readiness endpoints for deployment and ops monitoring
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
exports.setWebSocketState = setWebSocketState;
exports.getHealth = getHealth;
exports.getReady = getReady;
exports.getHealthDetailed = getHealthDetailed;
exports.getSyncStatus = getSyncStatus;
exports.forceSyncLiveMatches = forceSyncLiveMatches;
exports.getCacheStats = getCacheStats;
exports.clearCache = clearCache;
exports.getPerformanceDashboard = getPerformanceDashboard;
var connection_1 = require("../database/connection");
var config_1 = require("../config");
var obsLogger_1 = require("../utils/obsLogger");
var memoryCache_1 = require("../utils/cache/memoryCache");
var statsSync_job_1 = require("../jobs/statsSync.job");
var lineupPreSync_job_1 = require("../jobs/lineupPreSync.job");
// Track server start time for uptime calculation
var serverStartTime = Date.now();
// Track WebSocket service state (set by server.ts)
var websocketServiceState = null;
function setWebSocketState(enabled, connected) {
    websocketServiceState = { enabled: enabled, connected: connected };
}
/**
 * GET /health
 * Simple health check - returns 200 if server process is up
 */
function getHealth(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var uptimeSeconds;
        return __generator(this, function (_a) {
            uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
            reply.send({
                ok: true,
                service: 'goalgpt-server',
                uptime_s: uptimeSeconds,
                timestamp: new Date().toISOString(),
                commit: '8bdbb88', // Current commit hash
                formatter_version: 'V2-KART-KORNER-ENABLED',
                build_time: serverStartTime,
            });
            return [2 /*return*/];
        });
    });
}
/**
 * GET /ready
 * Readiness check - returns 200 only if critical dependencies are OK
 */
function getReady(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var checks, client, error_1, baseUrl, allOk, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    checks = {
                        db: { ok: false },
                        thesports: { ok: false },
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, connection_1.pool.connect()];
                case 2:
                    client = _a.sent();
                    return [4 /*yield*/, client.query('SELECT 1')];
                case 3:
                    _a.sent();
                    client.release();
                    checks.db = { ok: true };
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    checks.db = { ok: false, error: error_1.message || 'Connection failed' };
                    (0, obsLogger_1.logEvent)('warn', 'health.ready.db_failed', { error: error_1.message });
                    return [3 /*break*/, 5];
                case 5:
                    // Check TheSports API config
                    try {
                        baseUrl = config_1.config.thesports.baseUrl;
                        if (!baseUrl || baseUrl.trim() === '') {
                            checks.thesports = { ok: false, error: 'baseUrl not configured' };
                        }
                        else {
                            checks.thesports = { ok: true, baseUrl: baseUrl };
                        }
                    }
                    catch (error) {
                        checks.thesports = { ok: false, error: error.message || 'Config check failed' };
                    }
                    // Check WebSocket state (if available)
                    if (websocketServiceState) {
                        checks.websocket = {
                            enabled: websocketServiceState.enabled,
                            connected: websocketServiceState.connected,
                        };
                    }
                    allOk = checks.db.ok && checks.thesports.ok;
                    response = __assign(__assign({ ok: allOk, service: 'goalgpt-server', uptime_s: Math.floor((Date.now() - serverStartTime) / 1000), db: checks.db, thesports: checks.thesports }, (checks.websocket && { websocket: checks.websocket })), { time: {
                            now: Math.floor(Date.now() / 1000),
                            tz: 'Europe/Istanbul', // TSİ timezone
                        } });
                    if (allOk) {
                        reply.code(200).send(response);
                    }
                    else {
                        (0, obsLogger_1.logEvent)('warn', 'health.ready.failed', { checks: checks });
                        reply.code(503).send(response); // Service Unavailable
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * GET /health/detailed
 * Detailed health check with memory and system metrics
 */
function getHealthDetailed(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var memUsage, uptimeSeconds, hours, minutes, seconds, uptimeFormatted;
        return __generator(this, function (_a) {
            memUsage = process.memoryUsage();
            uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
            hours = Math.floor(uptimeSeconds / 3600);
            minutes = Math.floor((uptimeSeconds % 3600) / 60);
            seconds = uptimeSeconds % 60;
            uptimeFormatted = "".concat(hours, "h ").concat(minutes, "m ").concat(seconds, "s");
            reply.send({
                ok: true,
                service: 'goalgpt-server',
                uptime: {
                    seconds: uptimeSeconds,
                    formatted: uptimeFormatted,
                },
                memory: {
                    heapUsed: "".concat(Math.round(memUsage.heapUsed / 1024 / 1024), "MB"),
                    heapTotal: "".concat(Math.round(memUsage.heapTotal / 1024 / 1024), "MB"),
                    rss: "".concat(Math.round(memUsage.rss / 1024 / 1024), "MB"),
                    external: "".concat(Math.round(memUsage.external / 1024 / 1024), "MB"),
                    heapUsedBytes: memUsage.heapUsed,
                    heapTotalBytes: memUsage.heapTotal,
                },
                node: {
                    version: process.version,
                    platform: process.platform,
                    arch: process.arch,
                },
                timestamp: new Date().toISOString(),
            });
            return [2 /*return*/];
        });
    });
}
/**
 * GET /sync/status
 * Check sync gap between API live matches and database
 */
function getSyncStatus(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var dbResult, dbCount, apiUrl, apiResponse, apiData, apiCount, syncGap, syncStatus, error_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT COUNT(*) as count FROM ts_matches \n      WHERE status_id IN (2, 3, 4, 5, 7)\n    ")];
                case 1:
                    dbResult = _c.sent();
                    dbCount = parseInt(((_a = dbResult.rows[0]) === null || _a === void 0 ? void 0 : _a.count) || '0');
                    apiUrl = "".concat(config_1.config.thesports.baseUrl, "/match/detail_live?user=").concat(config_1.config.thesports.user, "&secret=").concat(config_1.config.thesports.secret);
                    return [4 /*yield*/, fetch(apiUrl)];
                case 2:
                    apiResponse = _c.sent();
                    return [4 /*yield*/, apiResponse.json()];
                case 3:
                    apiData = _c.sent();
                    apiCount = ((_b = apiData.results) === null || _b === void 0 ? void 0 : _b.length) || 0;
                    syncGap = apiCount - dbCount;
                    syncStatus = syncGap <= 5 ? 'healthy' : syncGap <= 15 ? 'warning' : 'critical';
                    reply.send({
                        ok: syncStatus === 'healthy',
                        syncStatus: syncStatus,
                        api: {
                            liveMatches: apiCount,
                        },
                        db: {
                            liveMatches: dbCount,
                        },
                        gap: syncGap,
                        message: syncGap <= 5
                            ? 'Sync is healthy'
                            : "".concat(syncGap, " matches missing from database"),
                        timestamp: new Date().toISOString(),
                    });
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _c.sent();
                    reply.code(500).send({
                        ok: false,
                        error: error_2.message,
                        timestamp: new Date().toISOString(),
                    });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * POST /sync/force
 * Force sync live matches from API to database
 */
function forceSyncLiveMatches(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var apiUrl, apiResponse, apiData, apiMatches, existingResult, existingIds_1, missingMatches, insertedCount, _i, missingMatches_1, match, score, statusId, homeScores, awayScores, updateTime, insertErr_1, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 10, , 11]);
                    apiUrl = "".concat(config_1.config.thesports.baseUrl, "/match/detail_live?user=").concat(config_1.config.thesports.user, "&secret=").concat(config_1.config.thesports.secret);
                    return [4 /*yield*/, fetch(apiUrl)];
                case 1:
                    apiResponse = _a.sent();
                    return [4 /*yield*/, apiResponse.json()];
                case 2:
                    apiData = _a.sent();
                    apiMatches = apiData.results || [];
                    if (apiMatches.length === 0) {
                        reply.send({
                            ok: true,
                            message: 'No live matches in API',
                            synced: 0,
                            timestamp: new Date().toISOString(),
                        });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT external_id FROM ts_matches \n      WHERE external_id = ANY($1)\n    ", [apiMatches.map(function (m) { return m.id; })])];
                case 3:
                    existingResult = _a.sent();
                    existingIds_1 = new Set(existingResult.rows.map(function (r) { return r.external_id; }));
                    missingMatches = apiMatches.filter(function (m) { return !existingIds_1.has(m.id); });
                    insertedCount = 0;
                    _i = 0, missingMatches_1 = missingMatches;
                    _a.label = 4;
                case 4:
                    if (!(_i < missingMatches_1.length)) return [3 /*break*/, 9];
                    match = missingMatches_1[_i];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    score = match.score || [];
                    statusId = score[1] || 1;
                    homeScores = score[2] || [0, 0, 0];
                    awayScores = score[3] || [0, 0, 0];
                    updateTime = score[4] || Math.floor(Date.now() / 1000);
                    return [4 /*yield*/, connection_1.pool.query("\n          INSERT INTO ts_matches (\n            external_id, status_id, home_score, away_score,\n            home_scores, away_scores, provider_update_time, updated_at\n          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())\n          ON CONFLICT (external_id) DO UPDATE SET\n            status_id = EXCLUDED.status_id,\n            home_score = EXCLUDED.home_score,\n            away_score = EXCLUDED.away_score,\n            updated_at = NOW()\n        ", [
                            match.id,
                            statusId,
                            homeScores[0] || 0,
                            awayScores[0] || 0,
                            JSON.stringify(homeScores),
                            JSON.stringify(awayScores),
                            updateTime
                        ])];
                case 6:
                    _a.sent();
                    insertedCount++;
                    return [3 /*break*/, 8];
                case 7:
                    insertErr_1 = _a.sent();
                    (0, obsLogger_1.logEvent)('warn', 'force_sync.insert_error', {
                        matchId: match.id,
                        error: insertErr_1.message
                    });
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9:
                    (0, obsLogger_1.logEvent)('info', 'force_sync.completed', {
                        apiCount: apiMatches.length,
                        existingCount: existingIds_1.size,
                        insertedCount: insertedCount,
                    });
                    reply.send({
                        ok: true,
                        message: "Force sync completed",
                        api: apiMatches.length,
                        existing: existingIds_1.size,
                        synced: insertedCount,
                        timestamp: new Date().toISOString(),
                    });
                    return [3 /*break*/, 11];
                case 10:
                    error_3 = _a.sent();
                    (0, obsLogger_1.logEvent)('error', 'force_sync.failed', { error: error_3.message });
                    reply.code(500).send({
                        ok: false,
                        error: error_3.message,
                        timestamp: new Date().toISOString(),
                    });
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * GET /cache/stats
 * Memory cache statistics for monitoring
 * Phase 5: Added for cache performance monitoring
 */
function getCacheStats(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var stats;
        return __generator(this, function (_a) {
            try {
                stats = memoryCache_1.memoryCache.getDetailedStats();
                reply.send({
                    ok: true,
                    cache: stats.caches,
                    totals: stats.totals,
                    memory: {
                        estimateMB: stats.memoryEstimateMB,
                        note: 'Rough estimate based on ~2KB per entry',
                    },
                    recommendations: generateCacheRecommendations(stats),
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                reply.code(500).send({
                    ok: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
            }
            return [2 /*return*/];
        });
    });
}
/**
 * POST /cache/clear
 * Clear all memory caches (emergency only)
 */
function clearCache(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                memoryCache_1.memoryCache.clearAll();
                reply.send({
                    ok: true,
                    message: 'All memory caches cleared',
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                reply.code(500).send({
                    ok: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Generate recommendations based on cache stats
 */
function generateCacheRecommendations(stats) {
    var recommendations = [];
    // Check overall hit rate
    if (stats.totals.hitRate < 50 && stats.totals.hits + stats.totals.misses > 100) {
        recommendations.push('Low cache hit rate (<50%). Consider increasing TTL or cache size.');
    }
    // Check individual caches
    for (var _i = 0, _a = Object.entries(stats.caches); _i < _a.length; _i++) {
        var _b = _a[_i], name_1 = _b[0], cacheStats = _b[1];
        if (cacheStats.hitRate < 30 && cacheStats.hits + cacheStats.misses > 50) {
            recommendations.push("Cache \"".concat(name_1, "\" has low hit rate (").concat(cacheStats.hitRate, "%). Review TTL settings."));
        }
        // Check if cache is near capacity
        if (cacheStats.keys >= cacheStats.config.maxKeys * 0.9) {
            recommendations.push("Cache \"".concat(name_1, "\" is near capacity (").concat(cacheStats.keys, "/").concat(cacheStats.config.maxKeys, "). Consider increasing maxKeys."));
        }
    }
    // Check memory usage
    if (stats.memoryEstimateMB > 40) {
        recommendations.push('Memory usage is high. Consider reducing cache sizes or TTLs.');
    }
    if (recommendations.length === 0) {
        recommendations.push('Cache performance is healthy.');
    }
    return recommendations;
}
/**
 * GET /perf/dashboard
 * Phase 9: Comprehensive performance monitoring dashboard
 * Returns all metrics needed to monitor match detail performance
 */
function getPerformanceDashboard(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, cacheStats, statsSyncStatus, lineupPreSyncStatus, dbStats, liveMatchResult, liveMatchCount, todayMatchResult, todayMatchCount, freshnessResult, freshness, duration, error_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    startTime = Date.now();
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, , 7]);
                    cacheStats = memoryCache_1.memoryCache.getDetailedStats();
                    statsSyncStatus = (0, statsSync_job_1.getStatsSyncStatus)();
                    lineupPreSyncStatus = (0, lineupPreSync_job_1.getLineupPreSyncStatus)();
                    return [4 /*yield*/, getDatabaseStats()];
                case 2:
                    dbStats = _c.sent();
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT COUNT(*) as count FROM ts_matches\n      WHERE status_id IN (2, 3, 4, 5, 7)\n    ")];
                case 3:
                    liveMatchResult = _c.sent();
                    liveMatchCount = parseInt(((_a = liveMatchResult.rows[0]) === null || _a === void 0 ? void 0 : _a.count) || '0');
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT COUNT(*) as count FROM ts_matches\n      WHERE DATE(to_timestamp(match_time)) = CURRENT_DATE\n    ")];
                case 4:
                    todayMatchResult = _c.sent();
                    todayMatchCount = parseInt(((_b = todayMatchResult.rows[0]) === null || _b === void 0 ? void 0 : _b.count) || '0');
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT\n        COUNT(*) FILTER (WHERE lineup_data IS NOT NULL AND lineup_data != '{}') as has_lineup,\n        COUNT(*) FILTER (WHERE h2h_data IS NOT NULL AND h2h_data != '{}') as has_h2h,\n        COUNT(*) FILTER (WHERE status_id = 1) as not_started\n      FROM ts_matches\n      WHERE match_time >= EXTRACT(EPOCH FROM NOW())\n        AND match_time <= EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours')\n    ")];
                case 5:
                    freshnessResult = _c.sent();
                    freshness = freshnessResult.rows[0] || {};
                    duration = Date.now() - startTime;
                    reply.send({
                        ok: true,
                        dashboard: {
                            // Cache Layer
                            cache: {
                                memory: cacheStats,
                                summary: {
                                    totalHitRate: cacheStats.totals.hitRate,
                                    totalKeys: cacheStats.totals.keys,
                                    memoryMB: cacheStats.memoryEstimateMB,
                                },
                            },
                            // Background Jobs
                            jobs: {
                                statsSync: __assign(__assign({}, statsSyncStatus), { description: 'Syncs live match stats every minute' }),
                                lineupPreSync: __assign(__assign({}, lineupPreSyncStatus), { description: 'Pre-fetches lineups for upcoming matches every 15 minutes' }),
                            },
                            // Database
                            database: dbStats,
                            // Match Counts
                            matches: {
                                live: liveMatchCount,
                                today: todayMatchCount,
                            },
                            // Data Freshness (upcoming 24h matches)
                            freshness: {
                                upcomingWithLineup: parseInt(freshness.has_lineup || '0'),
                                upcomingWithH2H: parseInt(freshness.has_h2h || '0'),
                                upcomingTotal: parseInt(freshness.not_started || '0'),
                                lineupCoverage: freshness.not_started > 0
                                    ? Math.round((freshness.has_lineup / freshness.not_started) * 100)
                                    : 100,
                                h2hCoverage: freshness.not_started > 0
                                    ? Math.round((freshness.has_h2h / freshness.not_started) * 100)
                                    : 100,
                            },
                            // Performance Targets
                            targets: {
                                cacheHitRate: { target: 90, current: cacheStats.totals.hitRate, status: cacheStats.totals.hitRate >= 90 ? 'OK' : 'BELOW' },
                                lineupCoverage: {
                                    target: 80,
                                    current: freshness.not_started > 0 ? Math.round((freshness.has_lineup / freshness.not_started) * 100) : 100,
                                    status: (freshness.not_started > 0 ? (freshness.has_lineup / freshness.not_started) * 100 : 100) >= 80 ? 'OK' : 'BELOW',
                                },
                            },
                            // Uptime
                            uptime: {
                                seconds: Math.floor((Date.now() - serverStartTime) / 1000),
                                formatted: formatUptime(Date.now() - serverStartTime),
                            },
                        },
                        meta: {
                            duration_ms: duration,
                            timestamp: new Date().toISOString(),
                        },
                    });
                    return [3 /*break*/, 7];
                case 6:
                    error_4 = _c.sent();
                    reply.code(500).send({
                        ok: false,
                        error: error_4.message,
                        timestamp: new Date().toISOString(),
                    });
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Helper: Get database statistics
 */
function getDatabaseStats() {
    return __awaiter(this, void 0, void 0, function () {
        var sizeResult, countResult, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT\n        relname as table_name,\n        pg_size_pretty(pg_total_relation_size(relid)) as total_size,\n        pg_total_relation_size(relid) as size_bytes\n      FROM pg_catalog.pg_statio_user_tables\n      WHERE relname IN ('ts_matches', 'ts_match_stats', 'ts_standings', 'ts_teams', 'ts_competitions')\n      ORDER BY pg_total_relation_size(relid) DESC\n    ")];
                case 1:
                    sizeResult = _a.sent();
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT\n        (SELECT COUNT(*) FROM ts_matches) as matches,\n        (SELECT COUNT(*) FROM ts_match_stats) as match_stats,\n        (SELECT COUNT(*) FROM ts_standings) as standings,\n        (SELECT COUNT(*) FROM ts_teams) as teams,\n        (SELECT COUNT(*) FROM ts_competitions) as competitions\n    ")];
                case 2:
                    countResult = _a.sent();
                    return [2 /*return*/, {
                            tables: sizeResult.rows,
                            counts: countResult.rows[0] || {},
                        }];
                case 3:
                    error_5 = _a.sent();
                    return [2 /*return*/, { error: error_5.message }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Helper: Format uptime in human-readable format
 */
function formatUptime(ms) {
    var seconds = Math.floor(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    if (days > 0) {
        return "".concat(days, "d ").concat(hours % 24, "h ").concat(minutes % 60, "m");
    }
    else if (hours > 0) {
        return "".concat(hours, "h ").concat(minutes % 60, "m ").concat(seconds % 60, "s");
    }
    else if (minutes > 0) {
        return "".concat(minutes, "m ").concat(seconds % 60, "s");
    }
    else {
        return "".concat(seconds, "s");
    }
}

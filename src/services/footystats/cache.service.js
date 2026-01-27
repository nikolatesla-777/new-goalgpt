"use strict";
/**
 * FootyStats Cache Service
 *
 * Implements TTL-based caching for FootyStats API responses
 * TTL Strategy:
 * - Pre-match: 24 hours
 * - Live: 5 minutes
 * - Completed: 7 days
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
exports.getCachedMatchStats = getCachedMatchStats;
exports.setCachedMatchStats = setCachedMatchStats;
exports.getCachedTeamForm = getCachedTeamForm;
exports.setCachedTeamForm = setCachedTeamForm;
exports.getCachedTodayMatches = getCachedTodayMatches;
exports.setCachedTodayMatches = setCachedTodayMatches;
exports.invalidateMatchCache = invalidateMatchCache;
exports.cleanupExpiredCache = cleanupExpiredCache;
exports.getCacheStats = getCacheStats;
var connection_1 = require("../../database/connection");
var logger_1 = require("../../utils/logger");
// ============================================================================
// TTL CALCULATION
// ============================================================================
/**
 * Calculate TTL (Time To Live) in seconds based on match status
 */
function calculateTTL(matchDateUnix, status) {
    var now = Date.now() / 1000;
    var matchDate = matchDateUnix;
    // Match is in the past (completed)
    if (matchDate < now) {
        return 7 * 24 * 60 * 60; // 7 days
    }
    // Match is live (within 2 hours of start time)
    if (Math.abs(matchDate - now) < 2 * 60 * 60) {
        return 5 * 60; // 5 minutes
    }
    // Match is upcoming (pre-match)
    return 24 * 60 * 60; // 24 hours
}
/**
 * Get expiration timestamp
 */
function getExpiresAt(ttlSeconds) {
    return new Date(Date.now() + ttlSeconds * 1000);
}
// ============================================================================
// MATCH STATS CACHE
// ============================================================================
/**
 * Get cached match stats
 */
function getCachedMatchStats(fsMatchId_1) {
    return __awaiter(this, arguments, void 0, function (fsMatchId, options) {
        var result, error_1;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (options.forceRefresh) {
                        logger_1.logger.info("[Cache] Force refresh requested for match ".concat(fsMatchId));
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, connection_1.pool.query("SELECT * FROM fs_match_stats\n       WHERE fs_match_id = $1\n       AND expires_at > NOW()\n       LIMIT 1", [fsMatchId])];
                case 2:
                    result = _a.sent();
                    if (!(result.rows.length === 0)) return [3 /*break*/, 4];
                    logger_1.logger.info("[Cache] Miss for match ".concat(fsMatchId));
                    return [4 /*yield*/, logCacheOperation('fs_match_stats', 'miss', fsMatchId.toString())];
                case 3:
                    _a.sent();
                    return [2 /*return*/, null];
                case 4: 
                // Increment hit count
                return [4 /*yield*/, connection_1.pool.query("UPDATE fs_match_stats SET hit_count = hit_count + 1 WHERE fs_match_id = $1", [fsMatchId])];
                case 5:
                    // Increment hit count
                    _a.sent();
                    logger_1.logger.info("[Cache] Hit for match ".concat(fsMatchId, " (hits: ").concat(result.rows[0].hit_count + 1, ")"));
                    return [4 /*yield*/, logCacheOperation('fs_match_stats', 'hit', fsMatchId.toString())];
                case 6:
                    _a.sent();
                    return [2 /*return*/, result.rows[0]];
                case 7:
                    error_1 = _a.sent();
                    logger_1.logger.error("[Cache] Error getting match stats: ".concat(error_1.message));
                    return [2 /*return*/, null];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Set cached match stats
 */
function setCachedMatchStats(data_1) {
    return __awaiter(this, arguments, void 0, function (data, options) {
        var ttl, expiresAt, error_2;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    ttl = options.ttlSeconds || calculateTTL(data.match_date_unix, data.status);
                    expiresAt = getExpiresAt(ttl);
                    return [4 /*yield*/, connection_1.pool.query("INSERT INTO fs_match_stats (\n        fs_match_id, home_name, away_name, competition_name, match_date_unix, status,\n        btts_potential, over25_potential, over15_potential, corners_potential,\n        cards_potential, shots_potential, fouls_potential,\n        xg_home_prematch, xg_away_prematch, xg_total,\n        odds_home, odds_draw, odds_away,\n        trends, h2h_data, form_data, api_response,\n        expires_at, updated_at\n      ) VALUES (\n        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,\n        $17, $18, $19, $20, $21, $22, $23, $24, NOW()\n      )\n      ON CONFLICT (fs_match_id) DO UPDATE SET\n        home_name = EXCLUDED.home_name,\n        away_name = EXCLUDED.away_name,\n        competition_name = EXCLUDED.competition_name,\n        match_date_unix = EXCLUDED.match_date_unix,\n        status = EXCLUDED.status,\n        btts_potential = EXCLUDED.btts_potential,\n        over25_potential = EXCLUDED.over25_potential,\n        over15_potential = EXCLUDED.over15_potential,\n        corners_potential = EXCLUDED.corners_potential,\n        cards_potential = EXCLUDED.cards_potential,\n        shots_potential = EXCLUDED.shots_potential,\n        fouls_potential = EXCLUDED.fouls_potential,\n        xg_home_prematch = EXCLUDED.xg_home_prematch,\n        xg_away_prematch = EXCLUDED.xg_away_prematch,\n        xg_total = EXCLUDED.xg_total,\n        odds_home = EXCLUDED.odds_home,\n        odds_draw = EXCLUDED.odds_draw,\n        odds_away = EXCLUDED.odds_away,\n        trends = EXCLUDED.trends,\n        h2h_data = EXCLUDED.h2h_data,\n        form_data = EXCLUDED.form_data,\n        api_response = EXCLUDED.api_response,\n        expires_at = EXCLUDED.expires_at,\n        updated_at = NOW()", [
                            data.fs_match_id, data.home_name, data.away_name, data.competition_name,
                            data.match_date_unix, data.status,
                            data.btts_potential, data.over25_potential, data.over15_potential,
                            data.corners_potential, data.cards_potential, data.shots_potential, data.fouls_potential,
                            data.xg_home_prematch, data.xg_away_prematch, data.xg_total,
                            data.odds_home, data.odds_draw, data.odds_away,
                            data.trends ? JSON.stringify(data.trends) : null,
                            data.h2h_data ? JSON.stringify(data.h2h_data) : null,
                            data.form_data ? JSON.stringify(data.form_data) : null,
                            data.api_response ? JSON.stringify(data.api_response) : null,
                            expiresAt
                        ])];
                case 1:
                    _a.sent();
                    logger_1.logger.info("[Cache] Stored match ".concat(data.fs_match_id, " with TTL ").concat(ttl, "s (expires: ").concat(expiresAt.toISOString(), ")"));
                    return [4 /*yield*/, logCacheOperation('fs_match_stats', 'write', data.fs_match_id.toString())];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error("[Cache] Error setting match stats: ".concat(error_2.message));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// TEAM FORM CACHE
// ============================================================================
/**
 * Get cached team form
 */
function getCachedTeamForm(fsTeamId_1, seasonId_1) {
    return __awaiter(this, arguments, void 0, function (fsTeamId, seasonId, options) {
        var query, params, result, error_3;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (options.forceRefresh) {
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    query = "SELECT * FROM fs_team_form WHERE fs_team_id = $1 AND expires_at > NOW()";
                    params = [fsTeamId];
                    if (seasonId) {
                        query += " AND season_id = $2";
                        params.push(seasonId);
                    }
                    query += " ORDER BY updated_at DESC LIMIT 1";
                    return [4 /*yield*/, connection_1.pool.query(query, params)];
                case 2:
                    result = _a.sent();
                    if (!(result.rows.length === 0)) return [3 /*break*/, 4];
                    logger_1.logger.info("[Cache] Miss for team form ".concat(fsTeamId));
                    return [4 /*yield*/, logCacheOperation('fs_team_form', 'miss', fsTeamId.toString())];
                case 3:
                    _a.sent();
                    return [2 /*return*/, null];
                case 4: 
                // Increment hit count
                return [4 /*yield*/, connection_1.pool.query("UPDATE fs_team_form SET hit_count = hit_count + 1 WHERE id = $1", [result.rows[0].id])];
                case 5:
                    // Increment hit count
                    _a.sent();
                    logger_1.logger.info("[Cache] Hit for team form ".concat(fsTeamId));
                    return [4 /*yield*/, logCacheOperation('fs_team_form', 'hit', fsTeamId.toString())];
                case 6:
                    _a.sent();
                    return [2 /*return*/, result.rows[0]];
                case 7:
                    error_3 = _a.sent();
                    logger_1.logger.error("[Cache] Error getting team form: ".concat(error_3.message));
                    return [2 /*return*/, null];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Set cached team form
 */
function setCachedTeamForm(data_1) {
    return __awaiter(this, arguments, void 0, function (data, options) {
        var ttl, expiresAt, error_4;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    ttl = options.ttlSeconds || 24 * 60 * 60;
                    expiresAt = getExpiresAt(ttl);
                    return [4 /*yield*/, connection_1.pool.query("INSERT INTO fs_team_form (\n        fs_team_id, season_id, team_name, form_string,\n        ppg_overall, ppg_home, ppg_away,\n        xg_for_avg, xg_against_avg, btts_percentage, over25_percentage,\n        form_data_overall, form_data_home, form_data_away,\n        expires_at, updated_at\n      ) VALUES (\n        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()\n      )\n      ON CONFLICT (fs_team_id, season_id) DO UPDATE SET\n        team_name = EXCLUDED.team_name,\n        form_string = EXCLUDED.form_string,\n        ppg_overall = EXCLUDED.ppg_overall,\n        ppg_home = EXCLUDED.ppg_home,\n        ppg_away = EXCLUDED.ppg_away,\n        xg_for_avg = EXCLUDED.xg_for_avg,\n        xg_against_avg = EXCLUDED.xg_against_avg,\n        btts_percentage = EXCLUDED.btts_percentage,\n        over25_percentage = EXCLUDED.over25_percentage,\n        form_data_overall = EXCLUDED.form_data_overall,\n        form_data_home = EXCLUDED.form_data_home,\n        form_data_away = EXCLUDED.form_data_away,\n        expires_at = EXCLUDED.expires_at,\n        updated_at = NOW()", [
                            data.fs_team_id, data.season_id, data.team_name, data.form_string,
                            data.ppg_overall, data.ppg_home, data.ppg_away,
                            data.xg_for_avg, data.xg_against_avg, data.btts_percentage, data.over25_percentage,
                            data.form_data_overall ? JSON.stringify(data.form_data_overall) : null,
                            data.form_data_home ? JSON.stringify(data.form_data_home) : null,
                            data.form_data_away ? JSON.stringify(data.form_data_away) : null,
                            expiresAt
                        ])];
                case 1:
                    _a.sent();
                    logger_1.logger.info("[Cache] Stored team form ".concat(data.fs_team_id, " with TTL ").concat(ttl, "s"));
                    return [4 /*yield*/, logCacheOperation('fs_team_form', 'write', data.fs_team_id.toString())];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_4 = _a.sent();
                    logger_1.logger.error("[Cache] Error setting team form: ".concat(error_4.message));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// TODAY'S MATCHES CACHE
// ============================================================================
/**
 * Get cached today's matches
 */
function getCachedTodayMatches() {
    return __awaiter(this, arguments, void 0, function (date, options) {
        var dateStr, result, error_5;
        if (date === void 0) { date = new Date(); }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (options.forceRefresh) {
                        return [2 /*return*/, null];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    dateStr = date.toISOString().split('T')[0];
                    return [4 /*yield*/, connection_1.pool.query("SELECT * FROM fs_today_matches_cache\n       WHERE cache_date = $1\n       AND expires_at > NOW()\n       LIMIT 1", [dateStr])];
                case 2:
                    result = _a.sent();
                    if (!(result.rows.length === 0)) return [3 /*break*/, 4];
                    logger_1.logger.info("[Cache] Miss for today's matches ".concat(dateStr));
                    return [4 /*yield*/, logCacheOperation('fs_today_matches_cache', 'miss', dateStr)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, null];
                case 4: 
                // Increment hit count
                return [4 /*yield*/, connection_1.pool.query("UPDATE fs_today_matches_cache SET hit_count = hit_count + 1 WHERE cache_date = $1", [dateStr])];
                case 5:
                    // Increment hit count
                    _a.sent();
                    logger_1.logger.info("[Cache] Hit for today's matches ".concat(dateStr));
                    return [4 /*yield*/, logCacheOperation('fs_today_matches_cache', 'hit', dateStr)];
                case 6:
                    _a.sent();
                    return [2 /*return*/, result.rows[0].matches_data];
                case 7:
                    error_5 = _a.sent();
                    logger_1.logger.error("[Cache] Error getting today's matches: ".concat(error_5.message));
                    return [2 /*return*/, null];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Set cached today's matches
 */
function setCachedTodayMatches(matches_1) {
    return __awaiter(this, arguments, void 0, function (matches, date, options) {
        var dateStr, ttl, expiresAt, error_6;
        if (date === void 0) { date = new Date(); }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    dateStr = date.toISOString().split('T')[0];
                    ttl = options.ttlSeconds || 60 * 60;
                    expiresAt = getExpiresAt(ttl);
                    return [4 /*yield*/, connection_1.pool.query("INSERT INTO fs_today_matches_cache (\n        cache_date, matches_data, match_count, expires_at, updated_at\n      ) VALUES (\n        $1, $2, $3, $4, NOW()\n      )\n      ON CONFLICT (cache_date) DO UPDATE SET\n        matches_data = EXCLUDED.matches_data,\n        match_count = EXCLUDED.match_count,\n        expires_at = EXCLUDED.expires_at,\n        updated_at = NOW()", [dateStr, JSON.stringify(matches), matches.length, expiresAt])];
                case 1:
                    _a.sent();
                    logger_1.logger.info("[Cache] Stored today's matches (".concat(matches.length, " matches) with TTL ").concat(ttl, "s"));
                    return [4 /*yield*/, logCacheOperation('fs_today_matches_cache', 'write', dateStr)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_6 = _a.sent();
                    logger_1.logger.error("[Cache] Error setting today's matches: ".concat(error_6.message));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// CACHE INVALIDATION
// ============================================================================
/**
 * Invalidate specific match cache
 */
function invalidateMatchCache(fsMatchId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, connection_1.pool.query("DELETE FROM fs_match_stats WHERE fs_match_id = $1", [fsMatchId])];
                case 1:
                    _a.sent();
                    logger_1.logger.info("[Cache] Invalidated match ".concat(fsMatchId));
                    return [4 /*yield*/, logCacheOperation('fs_match_stats', 'invalidate', fsMatchId.toString())];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_7 = _a.sent();
                    logger_1.logger.error("[Cache] Error invalidating match: ".concat(error_7.message));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Invalidate all expired cache entries
 */
function cleanupExpiredCache() {
    return __awaiter(this, void 0, void 0, function () {
        var results, totalDeleted, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.all([
                            connection_1.pool.query("DELETE FROM fs_match_stats WHERE expires_at < NOW()"),
                            connection_1.pool.query("DELETE FROM fs_team_form WHERE expires_at < NOW()"),
                            connection_1.pool.query("DELETE FROM fs_today_matches_cache WHERE expires_at < NOW()")
                        ])];
                case 1:
                    results = _a.sent();
                    totalDeleted = results.reduce(function (sum, r) { return sum + r.rowCount; }, 0);
                    logger_1.logger.info("[Cache] Cleanup: Deleted ".concat(totalDeleted, " expired entries"));
                    return [4 /*yield*/, logCacheOperation('all', 'cleanup', totalDeleted.toString())];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_8 = _a.sent();
                    logger_1.logger.error("[Cache] Cleanup error: ".concat(error_8.message));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// CACHE STATISTICS
// ============================================================================
/**
 * Log cache operation for monitoring
 */
function logCacheOperation(tableName, operation, entityId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection_1.pool.query("INSERT INTO fs_cache_stats (table_name, operation, entity_id, timestamp)\n       VALUES ($1, $2, $3, NOW())", [tableName, operation, entityId])];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_9 = _a.sent();
                    // Silent fail - don't break cache operations
                    logger_1.logger.debug("[Cache] Stats log error: ".concat(error_9.message));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get cache statistics
 */
function getCacheStats() {
    return __awaiter(this, void 0, void 0, function () {
        var stats, currentCounts, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT\n        table_name,\n        operation,\n        COUNT(*) as count,\n        MAX(timestamp) as last_operation\n      FROM fs_cache_stats\n      WHERE timestamp > NOW() - INTERVAL '24 hours'\n      GROUP BY table_name, operation\n      ORDER BY table_name, operation\n    ")];
                case 1:
                    stats = _a.sent();
                    return [4 /*yield*/, connection_1.pool.query("\n      SELECT\n        'fs_match_stats' as table_name,\n        COUNT(*) as total_entries,\n        SUM(hit_count) as total_hits\n      FROM fs_match_stats WHERE expires_at > NOW()\n      UNION ALL\n      SELECT\n        'fs_team_form' as table_name,\n        COUNT(*) as total_entries,\n        SUM(hit_count) as total_hits\n      FROM fs_team_form WHERE expires_at > NOW()\n      UNION ALL\n      SELECT\n        'fs_today_matches_cache' as table_name,\n        COUNT(*) as total_entries,\n        SUM(hit_count) as total_hits\n      FROM fs_today_matches_cache WHERE expires_at > NOW()\n    ")];
                case 2:
                    currentCounts = _a.sent();
                    return [2 /*return*/, {
                            operations_24h: stats.rows,
                            current_cache: currentCounts.rows
                        }];
                case 3:
                    error_10 = _a.sent();
                    logger_1.logger.error("[Cache] Error getting stats: ".concat(error_10.message));
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}

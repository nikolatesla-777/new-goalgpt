"use strict";
/**
 * Health Controller
 *
 * Provides health and readiness endpoints for deployment and ops monitoring
 */
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
const connection_1 = require("../database/connection");
const config_1 = require("../config");
const obsLogger_1 = require("../utils/obsLogger");
const memoryCache_1 = require("../utils/cache/memoryCache");
const statsSync_job_1 = require("../jobs/statsSync.job");
const lineupPreSync_job_1 = require("../jobs/lineupPreSync.job");
// Track server start time for uptime calculation
const serverStartTime = Date.now();
// Track WebSocket service state (set by server.ts)
let websocketServiceState = null;
function setWebSocketState(enabled, connected) {
    websocketServiceState = { enabled, connected };
}
/**
 * GET /health
 * Simple health check - returns 200 if server process is up
 */
async function getHealth(request, reply) {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    reply.send({
        ok: true,
        service: 'goalgpt-server',
        uptime_s: uptimeSeconds,
        timestamp: new Date().toISOString(),
    });
}
/**
 * GET /ready
 * Readiness check - returns 200 only if critical dependencies are OK
 */
async function getReady(request, reply) {
    const checks = {
        db: { ok: false },
        thesports: { ok: false },
    };
    // Check DB connection
    try {
        const client = await connection_1.pool.connect();
        await client.query('SELECT 1');
        client.release();
        checks.db = { ok: true };
    }
    catch (error) {
        checks.db = { ok: false, error: error.message || 'Connection failed' };
        (0, obsLogger_1.logEvent)('warn', 'health.ready.db_failed', { error: error.message });
    }
    // Check TheSports API config
    try {
        const baseUrl = config_1.config.thesports.baseUrl;
        if (!baseUrl || baseUrl.trim() === '') {
            checks.thesports = { ok: false, error: 'baseUrl not configured' };
        }
        else {
            checks.thesports = { ok: true, baseUrl };
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
    // Determine overall readiness
    const allOk = checks.db.ok && checks.thesports.ok;
    const response = {
        ok: allOk,
        service: 'goalgpt-server',
        uptime_s: Math.floor((Date.now() - serverStartTime) / 1000),
        db: checks.db,
        thesports: checks.thesports,
        ...(checks.websocket && { websocket: checks.websocket }),
        time: {
            now: Math.floor(Date.now() / 1000),
            tz: 'Europe/Istanbul', // TSİ timezone
        },
    };
    if (allOk) {
        reply.code(200).send(response);
    }
    else {
        (0, obsLogger_1.logEvent)('warn', 'health.ready.failed', { checks });
        reply.code(503).send(response); // Service Unavailable
    }
}
/**
 * GET /health/detailed
 * Detailed health check with memory and system metrics
 */
async function getHealthDetailed(request, reply) {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    // Format uptime as human readable
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
    reply.send({
        ok: true,
        service: 'goalgpt-server',
        uptime: {
            seconds: uptimeSeconds,
            formatted: uptimeFormatted,
        },
        memory: {
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
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
}
/**
 * GET /sync/status
 * Check sync gap between API live matches and database
 */
async function getSyncStatus(request, reply) {
    try {
        // Get DB live match count
        const dbResult = await connection_1.pool.query(`
      SELECT COUNT(*) as count FROM ts_matches 
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);
        const dbCount = parseInt(dbResult.rows[0]?.count || '0');
        // Get API live match count via fetch
        const apiUrl = `${config_1.config.thesports.baseUrl}/match/detail_live?user=${config_1.config.thesports.user}&secret=${config_1.config.thesports.secret}`;
        const apiResponse = await fetch(apiUrl);
        const apiData = await apiResponse.json();
        const apiCount = apiData.results?.length || 0;
        const syncGap = apiCount - dbCount;
        const syncStatus = syncGap <= 5 ? 'healthy' : syncGap <= 15 ? 'warning' : 'critical';
        reply.send({
            ok: syncStatus === 'healthy',
            syncStatus,
            api: {
                liveMatches: apiCount,
            },
            db: {
                liveMatches: dbCount,
            },
            gap: syncGap,
            message: syncGap <= 5
                ? 'Sync is healthy'
                : `${syncGap} matches missing from database`,
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
}
/**
 * POST /sync/force
 * Force sync live matches from API to database
 */
async function forceSyncLiveMatches(request, reply) {
    try {
        // Fetch live matches from API
        const apiUrl = `${config_1.config.thesports.baseUrl}/match/detail_live?user=${config_1.config.thesports.user}&secret=${config_1.config.thesports.secret}`;
        const apiResponse = await fetch(apiUrl);
        const apiData = await apiResponse.json();
        const apiMatches = apiData.results || [];
        if (apiMatches.length === 0) {
            reply.send({
                ok: true,
                message: 'No live matches in API',
                synced: 0,
                timestamp: new Date().toISOString(),
            });
            return;
        }
        // Get existing match IDs from DB
        const existingResult = await connection_1.pool.query(`
      SELECT external_id FROM ts_matches 
      WHERE external_id = ANY($1)
    `, [apiMatches.map((m) => m.id)]);
        const existingIds = new Set(existingResult.rows.map(r => r.external_id));
        // Find missing matches
        const missingMatches = apiMatches.filter((m) => !existingIds.has(m.id));
        // Insert missing matches with basic info
        let insertedCount = 0;
        for (const match of missingMatches) {
            try {
                const score = match.score || [];
                const statusId = score[1] || 1;
                const homeScores = score[2] || [0, 0, 0];
                const awayScores = score[3] || [0, 0, 0];
                const updateTime = score[4] || Math.floor(Date.now() / 1000);
                await connection_1.pool.query(`
          INSERT INTO ts_matches (
            external_id, status_id, home_score, away_score,
            home_scores, away_scores, provider_update_time, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (external_id) DO UPDATE SET
            status_id = EXCLUDED.status_id,
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            updated_at = NOW()
        `, [
                    match.id,
                    statusId,
                    homeScores[0] || 0,
                    awayScores[0] || 0,
                    JSON.stringify(homeScores),
                    JSON.stringify(awayScores),
                    updateTime
                ]);
                insertedCount++;
            }
            catch (insertErr) {
                (0, obsLogger_1.logEvent)('warn', 'force_sync.insert_error', {
                    matchId: match.id,
                    error: insertErr.message
                });
            }
        }
        (0, obsLogger_1.logEvent)('info', 'force_sync.completed', {
            apiCount: apiMatches.length,
            existingCount: existingIds.size,
            insertedCount,
        });
        reply.send({
            ok: true,
            message: `Force sync completed`,
            api: apiMatches.length,
            existing: existingIds.size,
            synced: insertedCount,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        (0, obsLogger_1.logEvent)('error', 'force_sync.failed', { error: error.message });
        reply.code(500).send({
            ok: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}
/**
 * GET /cache/stats
 * Memory cache statistics for monitoring
 * Phase 5: Added for cache performance monitoring
 */
async function getCacheStats(request, reply) {
    try {
        const stats = memoryCache_1.memoryCache.getDetailedStats();
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
}
/**
 * POST /cache/clear
 * Clear all memory caches (emergency only)
 */
async function clearCache(request, reply) {
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
}
/**
 * Generate recommendations based on cache stats
 */
function generateCacheRecommendations(stats) {
    const recommendations = [];
    // Check overall hit rate
    if (stats.totals.hitRate < 50 && stats.totals.hits + stats.totals.misses > 100) {
        recommendations.push('Low cache hit rate (<50%). Consider increasing TTL or cache size.');
    }
    // Check individual caches
    for (const [name, cacheStats] of Object.entries(stats.caches)) {
        if (cacheStats.hitRate < 30 && cacheStats.hits + cacheStats.misses > 50) {
            recommendations.push(`Cache "${name}" has low hit rate (${cacheStats.hitRate}%). Review TTL settings.`);
        }
        // Check if cache is near capacity
        if (cacheStats.keys >= cacheStats.config.maxKeys * 0.9) {
            recommendations.push(`Cache "${name}" is near capacity (${cacheStats.keys}/${cacheStats.config.maxKeys}). Consider increasing maxKeys.`);
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
async function getPerformanceDashboard(request, reply) {
    const startTime = Date.now();
    try {
        // 1. Cache Statistics
        const cacheStats = memoryCache_1.memoryCache.getDetailedStats();
        // 2. Job Status
        const statsSyncStatus = (0, statsSync_job_1.getStatsSyncStatus)();
        const lineupPreSyncStatus = (0, lineupPreSync_job_1.getLineupPreSyncStatus)();
        // 3. Database Statistics
        const dbStats = await getDatabaseStats();
        // 4. Live Match Count
        const liveMatchResult = await connection_1.pool.query(`
      SELECT COUNT(*) as count FROM ts_matches
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);
        const liveMatchCount = parseInt(liveMatchResult.rows[0]?.count || '0');
        // 5. Today's Match Count
        const todayMatchResult = await connection_1.pool.query(`
      SELECT COUNT(*) as count FROM ts_matches
      WHERE DATE(to_timestamp(match_time)) = CURRENT_DATE
    `);
        const todayMatchCount = parseInt(todayMatchResult.rows[0]?.count || '0');
        // 6. Data Freshness Check
        const freshnessResult = await connection_1.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE lineup_data IS NOT NULL AND lineup_data != '{}') as has_lineup,
        COUNT(*) FILTER (WHERE h2h_data IS NOT NULL AND h2h_data != '{}') as has_h2h,
        COUNT(*) FILTER (WHERE status_id = 1) as not_started
      FROM ts_matches
      WHERE match_time >= EXTRACT(EPOCH FROM NOW())
        AND match_time <= EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours')
    `);
        const freshness = freshnessResult.rows[0] || {};
        const duration = Date.now() - startTime;
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
                    statsSync: {
                        ...statsSyncStatus,
                        description: 'Syncs live match stats every minute',
                    },
                    lineupPreSync: {
                        ...lineupPreSyncStatus,
                        description: 'Pre-fetches lineups for upcoming matches every 15 minutes',
                    },
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
    }
    catch (error) {
        reply.code(500).send({
            ok: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}
/**
 * Helper: Get database statistics
 */
async function getDatabaseStats() {
    try {
        // Get table sizes
        const sizeResult = await connection_1.pool.query(`
      SELECT
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_total_relation_size(relid) as size_bytes
      FROM pg_catalog.pg_statio_user_tables
      WHERE relname IN ('ts_matches', 'ts_match_stats', 'ts_standings', 'ts_teams', 'ts_competitions')
      ORDER BY pg_total_relation_size(relid) DESC
    `);
        // Get row counts for main tables
        const countResult = await connection_1.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM ts_matches) as matches,
        (SELECT COUNT(*) FROM ts_match_stats) as match_stats,
        (SELECT COUNT(*) FROM ts_standings) as standings,
        (SELECT COUNT(*) FROM ts_teams) as teams,
        (SELECT COUNT(*) FROM ts_competitions) as competitions
    `);
        return {
            tables: sizeResult.rows,
            counts: countResult.rows[0] || {},
        };
    }
    catch (error) {
        return { error: error.message };
    }
}
/**
 * Helper: Format uptime in human-readable format
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    else if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    else {
        return `${seconds}s`;
    }
}

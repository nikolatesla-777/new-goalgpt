/**
 * Health Controller
 * 
 * Provides health and readiness endpoints for deployment and ops monitoring
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../database/connection';
import { config } from '../config';
import { logEvent } from '../utils/obsLogger';
import { memoryCache } from '../utils/cache/memoryCache';
import { getStatsSyncStatus } from '../jobs/statsSync.job';
import { getLineupPreSyncStatus } from '../jobs/lineupPreSync.job';

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Track WebSocket service state (set by server.ts)
let websocketServiceState: { enabled: boolean; connected: boolean } | null = null;

export function setWebSocketState(enabled: boolean, connected: boolean): void {
  websocketServiceState = { enabled, connected };
}

/**
 * GET /health
 * Simple health check - returns 200 if server process is up
 */
export async function getHealth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

  reply.send({
    ok: true,
    service: 'goalgpt-server',
    uptime_s: uptimeSeconds,
    timestamp: new Date().toISOString(),
    commit: '8bdbb88', // Current commit hash
    formatter_version: 'V2-KART-KORNER-ENABLED',
    build_time: serverStartTime,
  });
}

/**
 * GET /ready
 * Readiness check - returns 200 only if critical dependencies are OK
 */
export async function getReady(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const checks: {
    db: { ok: boolean; error?: string };
    thesports: { ok: boolean; baseUrl?: string; error?: string };
    websocket?: { enabled: boolean; connected: boolean };
  } = {
    db: { ok: false },
    thesports: { ok: false },
  };

  // Check DB connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    checks.db = { ok: true };
  } catch (error: any) {
    checks.db = { ok: false, error: error.message || 'Connection failed' };
    logEvent('warn', 'health.ready.db_failed', { error: error.message });
  }

  // Check TheSports API config
  try {
    const baseUrl = config.thesports.baseUrl;
    if (!baseUrl || baseUrl.trim() === '') {
      checks.thesports = { ok: false, error: 'baseUrl not configured' };
    } else {
      checks.thesports = { ok: true, baseUrl };
    }
  } catch (error: any) {
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
  } else {
    logEvent('warn', 'health.ready.failed', { checks });
    reply.code(503).send(response); // Service Unavailable
  }
}

/**
 * GET /health/detailed
 * Detailed health check with memory and system metrics
 */
export async function getHealthDetailed(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
export async function getSyncStatus(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get DB live match count
    const dbResult = await pool.query(`
      SELECT COUNT(*) as count FROM ts_matches 
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);
    const dbCount = parseInt(dbResult.rows[0]?.count || '0');

    // Get API live match count via fetch
    const apiUrl = `${config.thesports.baseUrl}/match/detail_live?user=${config.thesports.user}&secret=${config.thesports.secret}`;
    const apiResponse = await fetch(apiUrl);
    const apiData = await apiResponse.json() as any;
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
  } catch (error: any) {
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
export async function forceSyncLiveMatches(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Fetch live matches from API
    const apiUrl = `${config.thesports.baseUrl}/match/detail_live?user=${config.thesports.user}&secret=${config.thesports.secret}`;
    const apiResponse = await fetch(apiUrl);
    const apiData = await apiResponse.json() as any;
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
    const existingResult = await pool.query(`
      SELECT external_id FROM ts_matches 
      WHERE external_id = ANY($1)
    `, [apiMatches.map((m: any) => m.id)]);
    const existingIds = new Set(existingResult.rows.map(r => r.external_id));

    // Find missing matches
    const missingMatches = apiMatches.filter((m: any) => !existingIds.has(m.id));

    // Insert missing matches with basic info
    let insertedCount = 0;
    for (const match of missingMatches) {
      try {
        const score = match.score || [];
        const statusId = score[1] || 1;
        const homeScores = score[2] || [0, 0, 0];
        const awayScores = score[3] || [0, 0, 0];
        const updateTime = score[4] || Math.floor(Date.now() / 1000);

        await pool.query(`
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
      } catch (insertErr: any) {
        logEvent('warn', 'force_sync.insert_error', {
          matchId: match.id,
          error: insertErr.message
        });
      }
    }

    logEvent('info', 'force_sync.completed', {
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
  } catch (error: any) {
    logEvent('error', 'force_sync.failed', { error: error.message });
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
export async function getCacheStats(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const stats = memoryCache.getDetailedStats();

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
  } catch (error: any) {
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
export async function clearCache(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    memoryCache.clearAll();

    reply.send({
      ok: true,
      message: 'All memory caches cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
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
function generateCacheRecommendations(stats: any): string[] {
  const recommendations: string[] = [];

  // Check overall hit rate
  if (stats.totals.hitRate < 50 && stats.totals.hits + stats.totals.misses > 100) {
    recommendations.push('Low cache hit rate (<50%). Consider increasing TTL or cache size.');
  }

  // Check individual caches
  for (const [name, cacheStats] of Object.entries(stats.caches) as [string, any][]) {
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
export async function getPerformanceDashboard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Cache Statistics
    const cacheStats = memoryCache.getDetailedStats();

    // 2. Job Status
    const statsSyncStatus = getStatsSyncStatus();
    const lineupPreSyncStatus = getLineupPreSyncStatus();

    // 3. Database Statistics
    const dbStats = await getDatabaseStats();

    // 4. Live Match Count
    const liveMatchResult = await pool.query(`
      SELECT COUNT(*) as count FROM ts_matches
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);
    const liveMatchCount = parseInt(liveMatchResult.rows[0]?.count || '0');

    // 5. Today's Match Count
    const todayMatchResult = await pool.query(`
      SELECT COUNT(*) as count FROM ts_matches
      WHERE DATE(to_timestamp(match_time)) = CURRENT_DATE
    `);
    const todayMatchCount = parseInt(todayMatchResult.rows[0]?.count || '0');

    // 6. Data Freshness Check
    const freshnessResult = await pool.query(`
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

  } catch (error: any) {
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
async function getDatabaseStats(): Promise<any> {
  try {
    // Get table sizes
    const sizeResult = await pool.query(`
      SELECT
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_total_relation_size(relid) as size_bytes
      FROM pg_catalog.pg_statio_user_tables
      WHERE relname IN ('ts_matches', 'ts_match_stats', 'ts_standings', 'ts_teams', 'ts_competitions')
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    // Get row counts for main tables
    const countResult = await pool.query(`
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

  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Helper: Format uptime in human-readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}


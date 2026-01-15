/**
 * Health Controller
 * 
 * Provides health and readiness endpoints for deployment and ops monitoring
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../database/connection';
import { config } from '../config';
import { logEvent } from '../utils/obsLogger';

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


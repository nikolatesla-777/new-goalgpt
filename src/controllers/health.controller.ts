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







/**
 * Pool Monitor - Database Connection Pool Health Monitoring
 *
 * PR-9: DB Connection Safety
 *
 * Features:
 * - Real-time pool statistics
 * - Periodic metrics emission
 * - High utilization warnings
 * - Pool exhaustion detection
 *
 * Usage:
 * ```typescript
 * import { startPoolMonitor, stopPoolMonitor, getPoolStats } from './database/poolMonitor';
 *
 * // Start monitoring (every 30 seconds)
 * startPoolMonitor(30000);
 *
 * // Get current stats
 * const stats = getPoolStats();
 * console.log(`Active: ${stats.totalCount - stats.idleCount}`);
 *
 * // Stop monitoring
 * stopPoolMonitor();
 * ```
 */

import { pool } from './connection';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// ============================================================
// TYPES
// ============================================================

export interface PoolStats {
  /** Total number of clients in the pool */
  totalCount: number;
  /** Number of idle (available) clients */
  idleCount: number;
  /** Number of queries waiting for a client */
  waitingCount: number;
  /** Number of active (in-use) clients */
  activeCount: number;
  /** Pool utilization percentage (0-100) */
  utilizationPct: number;
}

// ============================================================
// POOL STATS
// ============================================================

/**
 * Get current pool statistics
 */
export function getPoolStats(): PoolStats {
  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  const waitingCount = pool.waitingCount;
  const activeCount = totalCount - idleCount;

  // Max connections from pool config (default 25)
  const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '25');
  const utilizationPct = maxConnections > 0
    ? (activeCount / maxConnections) * 100
    : 0;

  return {
    totalCount,
    idleCount,
    waitingCount,
    activeCount,
    utilizationPct,
  };
}

// ============================================================
// METRICS EMISSION
// ============================================================

// Rate-limiting state for log throttling
let lastWarnLog = 0;
let lastErrorLog = 0;

/**
 * Emit pool metrics and log warnings if needed (original - no rate-limiting)
 */
export function emitPoolMetrics(): void {
  const stats = getPoolStats();

  // Emit metrics
  metrics.set('db.pool.total', stats.totalCount);
  metrics.set('db.pool.idle', stats.idleCount);
  metrics.set('db.pool.active', stats.activeCount);
  metrics.set('db.pool.waiting', stats.waitingCount);
  metrics.set('db.pool.utilization_pct', stats.utilizationPct);

  // Log at different levels based on utilization
  if (stats.utilizationPct > 90) {
    logger.error('[PoolMonitor] CRITICAL: Pool near exhaustion!', {
      ...stats,
      utilization: `${stats.utilizationPct.toFixed(1)}%`,
    });
    metrics.inc('db.pool.critical_warning');
  } else if (stats.utilizationPct > 80) {
    logger.warn('[PoolMonitor] HIGH: Pool utilization elevated', {
      ...stats,
      utilization: `${stats.utilizationPct.toFixed(1)}%`,
    });
    metrics.inc('db.pool.high_warning');
  } else if (stats.waitingCount > 0) {
    // Any waiting queries is a concern
    logger.warn('[PoolMonitor] Queries waiting for connection', {
      waiting: stats.waitingCount,
      active: stats.activeCount,
      idle: stats.idleCount,
    });
    metrics.inc('db.pool.waiting_queries');
  } else {
    // Normal operation - debug level
    logger.debug('[PoolMonitor] Pool healthy', {
      utilization: `${stats.utilizationPct.toFixed(1)}%`,
      active: stats.activeCount,
      idle: stats.idleCount,
    });
  }
}

/**
 * Emit pool metrics with rate-limited logging
 *
 * - ALWAYS emits metrics (no throttling)
 * - Rate-limits log messages based on DB_POOL_LOG_INTERVAL_MS (default: 60s)
 * - Uses configurable thresholds for WARN and CRITICAL alerts
 */
export function emitPoolMetricsRateLimited(): void {
  const stats = getPoolStats();
  const now = Date.now();

  // ALWAYS emit metrics (no rate-limiting)
  metrics.set('db.pool.total', stats.totalCount);
  metrics.set('db.pool.idle', stats.idleCount);
  metrics.set('db.pool.active', stats.activeCount);
  metrics.set('db.pool.waiting', stats.waitingCount);
  metrics.set('db.pool.utilization_pct', stats.utilizationPct);

  // Rate-limited logging
  const warnThreshold = parseInt(process.env.DB_POOL_UTIL_WARN_PCT || '80');
  const critThreshold = parseInt(process.env.DB_POOL_UTIL_CRIT_PCT || '90');
  const throttleMs = parseInt(process.env.DB_POOL_LOG_INTERVAL_MS || '60000');

  // CRITICAL: waitingCount > 0 OR utilization >= 90%
  if (stats.waitingCount > 0 || stats.utilizationPct >= critThreshold) {
    if (now - lastErrorLog > throttleMs) {
      logger.error('[PoolMonitor] CRITICAL: Pool near exhaustion!', {
        ...stats,
        utilization: `${stats.utilizationPct.toFixed(1)}%`,
      });
      metrics.inc('db.pool.critical_warning');
      lastErrorLog = now;
    }
  }
  // WARN: utilization >= 80%
  else if (stats.utilizationPct >= warnThreshold) {
    if (now - lastWarnLog > throttleMs) {
      logger.warn('[PoolMonitor] HIGH: Pool utilization elevated', {
        ...stats,
        utilization: `${stats.utilizationPct.toFixed(1)}%`,
      });
      metrics.inc('db.pool.high_warning');
      lastWarnLog = now;
    }
  }
}

// ============================================================
// MONITORING LIFECYCLE
// ============================================================

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Start pool monitoring
 *
 * @param intervalMs - Monitoring interval in milliseconds (default: 30000)
 */
export function startPoolMonitor(intervalMs: number = 30000): void {
  if (monitorInterval) {
    logger.warn('[PoolMonitor] Already running, skipping start');
    return;
  }

  // Check env flag
  if (process.env.DB_MONITOR_ENABLED === 'false') {
    logger.info('[PoolMonitor] Disabled via DB_MONITOR_ENABLED=false');
    return;
  }

  // Emit initial metrics (with rate-limiting)
  emitPoolMetricsRateLimited();

  // Start periodic monitoring (with rate-limiting)
  monitorInterval = setInterval(emitPoolMetricsRateLimited, intervalMs);

  logger.info('[PoolMonitor] Started', {
    intervalMs,
    maxConnections: process.env.DB_MAX_CONNECTIONS || '25',
    warnThreshold: `${process.env.DB_POOL_UTIL_WARN_PCT || '80'}%`,
    critThreshold: `${process.env.DB_POOL_UTIL_CRIT_PCT || '90'}%`,
  });
}

/**
 * Stop pool monitoring
 */
export function stopPoolMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[PoolMonitor] Stopped');
  }
}

/**
 * Check if monitoring is active
 */
export function isMonitoringActive(): boolean {
  return monitorInterval !== null;
}

// ============================================================
// POOL HEALTH CHECK
// ============================================================

/**
 * Perform a quick pool health check
 * Returns true if pool is healthy, false otherwise
 */
export async function checkPoolHealth(): Promise<{
  healthy: boolean;
  stats: PoolStats;
  error?: string;
}> {
  const stats = getPoolStats();

  // Check for concerning conditions
  if (stats.utilizationPct > 95) {
    return {
      healthy: false,
      stats,
      error: 'Pool near exhaustion (>95% utilized)',
    };
  }

  if (stats.waitingCount > 5) {
    return {
      healthy: false,
      stats,
      error: `Too many queries waiting for connection (${stats.waitingCount})`,
    };
  }

  // Try to acquire and release a connection
  try {
    const start = Date.now();
    const client = await pool.connect();
    const acquireTime = Date.now() - start;
    client.release();

    // Warn if acquisition took too long
    if (acquireTime > 1000) {
      return {
        healthy: true,
        stats,
        error: `Slow connection acquisition (${acquireTime}ms)`,
      };
    }

    return { healthy: true, stats };
  } catch (err: any) {
    return {
      healthy: false,
      stats,
      error: `Failed to acquire connection: ${err.message}`,
    };
  }
}

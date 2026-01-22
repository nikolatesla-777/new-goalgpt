"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPoolStats = getPoolStats;
exports.emitPoolMetrics = emitPoolMetrics;
exports.startPoolMonitor = startPoolMonitor;
exports.stopPoolMonitor = stopPoolMonitor;
exports.isMonitoringActive = isMonitoringActive;
exports.checkPoolHealth = checkPoolHealth;
const connection_1 = require("./connection");
const logger_1 = require("../utils/logger");
const metrics_1 = require("../utils/metrics");
// ============================================================
// POOL STATS
// ============================================================
/**
 * Get current pool statistics
 */
function getPoolStats() {
    const totalCount = connection_1.pool.totalCount;
    const idleCount = connection_1.pool.idleCount;
    const waitingCount = connection_1.pool.waitingCount;
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
/**
 * Emit pool metrics and log warnings if needed
 */
function emitPoolMetrics() {
    const stats = getPoolStats();
    // Emit metrics
    metrics_1.metrics.set('db.pool.total', stats.totalCount);
    metrics_1.metrics.set('db.pool.idle', stats.idleCount);
    metrics_1.metrics.set('db.pool.active', stats.activeCount);
    metrics_1.metrics.set('db.pool.waiting', stats.waitingCount);
    metrics_1.metrics.set('db.pool.utilization_pct', stats.utilizationPct);
    // Log at different levels based on utilization
    if (stats.utilizationPct > 90) {
        logger_1.logger.error('[PoolMonitor] CRITICAL: Pool near exhaustion!', {
            ...stats,
            utilization: `${stats.utilizationPct.toFixed(1)}%`,
        });
        metrics_1.metrics.inc('db.pool.critical_warning');
    }
    else if (stats.utilizationPct > 80) {
        logger_1.logger.warn('[PoolMonitor] HIGH: Pool utilization elevated', {
            ...stats,
            utilization: `${stats.utilizationPct.toFixed(1)}%`,
        });
        metrics_1.metrics.inc('db.pool.high_warning');
    }
    else if (stats.waitingCount > 0) {
        // Any waiting queries is a concern
        logger_1.logger.warn('[PoolMonitor] Queries waiting for connection', {
            waiting: stats.waitingCount,
            active: stats.activeCount,
            idle: stats.idleCount,
        });
        metrics_1.metrics.inc('db.pool.waiting_queries');
    }
    else {
        // Normal operation - debug level
        logger_1.logger.debug('[PoolMonitor] Pool healthy', {
            utilization: `${stats.utilizationPct.toFixed(1)}%`,
            active: stats.activeCount,
            idle: stats.idleCount,
        });
    }
}
// ============================================================
// MONITORING LIFECYCLE
// ============================================================
let monitorInterval = null;
/**
 * Start pool monitoring
 *
 * @param intervalMs - Monitoring interval in milliseconds (default: 30000)
 */
function startPoolMonitor(intervalMs = 30000) {
    if (monitorInterval) {
        logger_1.logger.warn('[PoolMonitor] Already running, skipping start');
        return;
    }
    // Emit initial metrics
    emitPoolMetrics();
    // Start periodic monitoring
    monitorInterval = setInterval(emitPoolMetrics, intervalMs);
    logger_1.logger.info('[PoolMonitor] Started', {
        intervalMs,
        maxConnections: process.env.DB_MAX_CONNECTIONS || '25',
    });
}
/**
 * Stop pool monitoring
 */
function stopPoolMonitor() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        logger_1.logger.info('[PoolMonitor] Stopped');
    }
}
/**
 * Check if monitoring is active
 */
function isMonitoringActive() {
    return monitorInterval !== null;
}
// ============================================================
// POOL HEALTH CHECK
// ============================================================
/**
 * Perform a quick pool health check
 * Returns true if pool is healthy, false otherwise
 */
async function checkPoolHealth() {
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
        const client = await connection_1.pool.connect();
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
    }
    catch (err) {
        return {
            healthy: false,
            stats,
            error: `Failed to acquire connection: ${err.message}`,
        };
    }
}

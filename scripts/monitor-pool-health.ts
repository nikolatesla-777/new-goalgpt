/**
 * Pool Health Monitoring Script
 * Run: tsx scripts/monitor-pool-health.ts
 *
 * Monitors:
 * - MaxClients errors (target: 0, trigger: >3 in 1h)
 * - Cache hit rate (target: >60%, trigger: <50%)
 * - Predictions endpoint p95 latency (target: <150ms, trigger: >250ms for 10min)
 * - DB active connections (trigger: >45 for 5min+)
 */

import { pool } from '../src/database/connection';
import { memoryCache } from '../src/utils/cache/memoryCache';
import { logger } from '../src/utils/logger';

interface PoolHealthMetrics {
  timestamp: number;
  maxClientsErrors: number;
  cacheHitRate: number;
  predictionsP95Ms: number | null;
  dbActiveConnections: number;
  poolMax: number;
  poolIdle: number;
  poolWaiting: number;
}

class PoolHealthMonitor {
  private metrics: PoolHealthMetrics[] = [];
  private maxClientsErrorCount = 0;
  private lastCheckTime = Date.now();

  async collectMetrics(): Promise<PoolHealthMetrics> {
    // Get cache stats
    const cacheStats = memoryCache.getStats();
    const predictionStats = cacheStats['predictions'] || { hits: 0, misses: 0, hitRate: 0 };

    // Get DB connection stats
    let dbActiveConnections = 0;
    try {
      const client = await pool.connect();
      const result = await client.query(
        "SELECT count(*) as active FROM pg_stat_activity WHERE state = 'active' AND application_name = 'goalgpt-backend'"
      );
      dbActiveConnections = parseInt(result.rows[0]?.active || '0');
      client.release();
    } catch (err) {
      logger.warn('[PoolHealthMonitor] Failed to query DB connections:', err);
    }

    // Get pool stats
    const poolMax = pool.options.max || 50;
    const poolIdle = pool.idleCount || 0;
    const poolWaiting = pool.waitingCount || 0;

    return {
      timestamp: Date.now(),
      maxClientsErrors: this.maxClientsErrorCount,
      cacheHitRate: predictionStats.hitRate,
      predictionsP95Ms: null, // TODO: Implement histogram tracking
      dbActiveConnections,
      poolMax,
      poolIdle,
      poolWaiting,
    };
  }

  checkAlerts(metrics: PoolHealthMetrics): string[] {
    const alerts: string[] = [];

    // Alert: MaxClients errors
    if (metrics.maxClientsErrors > 0) {
      alerts.push(`🚨 MaxClients errors detected: ${metrics.maxClientsErrors} (target: 0)`);
    }

    // Alert: Cache hit rate too low
    if (metrics.cacheHitRate < 50) {
      alerts.push(`⚠️ Cache hit rate low: ${metrics.cacheHitRate}% (target: >60%, trigger: <50%)`);
    }

    // Alert: DB active connections high
    if (metrics.dbActiveConnections > 45) {
      alerts.push(`⚠️ DB active connections high: ${metrics.dbActiveConnections}/${metrics.poolMax} (trigger: >45)`);
    }

    // Alert: Pool waiting queue
    if (metrics.poolWaiting > 5) {
      alerts.push(`⚠️ Pool waiting queue: ${metrics.poolWaiting} requests waiting`);
    }

    return alerts;
  }

  async run(intervalSec = 60, durationSec = 86400): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (durationSec * 1000);

    logger.info('[PoolHealthMonitor] Starting 24h monitoring', {
      interval: `${intervalSec}s`,
      duration: `${durationSec}s (${durationSec / 3600}h)`,
      targets: {
        maxClientsErrors: 0,
        cacheHitRate: '>60%',
        dbActiveConnections: '<45',
      },
    });

    const intervalId = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);

        // Keep only last 24h of metrics
        const cutoff = Date.now() - (24 * 3600 * 1000);
        this.metrics = this.metrics.filter(m => m.timestamp > cutoff);

        // Check alerts
        const alerts = this.checkAlerts(metrics);

        // Log current status
        logger.info('[PoolHealthMonitor] Status', {
          maxClientsErrors: metrics.maxClientsErrors,
          cacheHitRate: `${metrics.cacheHitRate}%`,
          dbActive: `${metrics.dbActiveConnections}/${metrics.poolMax}`,
          poolIdle: metrics.poolIdle,
          poolWaiting: metrics.poolWaiting,
          alerts: alerts.length > 0 ? alerts : 'none',
        });

        // Print alerts
        if (alerts.length > 0) {
          console.log('\n=== ALERTS ===');
          alerts.forEach(alert => console.log(alert));
          console.log('');
        }

        // Stop after duration
        if (Date.now() > endTime) {
          clearInterval(intervalId);
          this.generateReport();
          await pool.end();
          process.exit(0);
        }
      } catch (err) {
        logger.error('[PoolHealthMonitor] Error collecting metrics:', err);
      }
    }, intervalSec * 1000);

    // Run first check immediately
    const metrics = await this.collectMetrics();
    this.metrics.push(metrics);
    const alerts = this.checkAlerts(metrics);
    if (alerts.length > 0) {
      console.log('\n=== INITIAL ALERTS ===');
      alerts.forEach(alert => console.log(alert));
      console.log('');
    }
  }

  generateReport(): void {
    if (this.metrics.length === 0) {
      logger.warn('[PoolHealthMonitor] No metrics collected');
      return;
    }

    // Calculate statistics
    const cacheHitRates = this.metrics.map(m => m.cacheHitRate);
    const dbActiveConns = this.metrics.map(m => m.dbActiveConnections);

    const avgCacheHitRate = cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length;
    const maxDbActiveConns = Math.max(...dbActiveConns);
    const avgDbActiveConns = dbActiveConns.reduce((a, b) => a + b, 0) / dbActiveConns.length;

    console.log('\n=== 24H MONITORING REPORT ===\n');
    console.log('Duration:', `${this.metrics.length} samples`);
    console.log('Start:', new Date(this.metrics[0].timestamp).toISOString());
    console.log('End:', new Date(this.metrics[this.metrics.length - 1].timestamp).toISOString());
    console.log('');
    console.log('MaxClients Errors:', this.maxClientsErrorCount, '(target: 0)');
    console.log('Cache Hit Rate (avg):', `${avgCacheHitRate.toFixed(1)}%`, '(target: >60%)');
    console.log('DB Active Connections (avg):', avgDbActiveConns.toFixed(1), '(max:', maxDbActiveConns, ', limit: 45)');
    console.log('');

    // Recommendations
    console.log('=== RECOMMENDATIONS ===\n');
    if (this.maxClientsErrorCount > 0) {
      console.log('⚠️ MaxClients errors detected → Investigate query optimization or increase pool max');
    }
    if (avgCacheHitRate < 50) {
      console.log('⚠️ Cache hit rate low → Increase TTL from 30s to 60s');
    }
    if (maxDbActiveConns > 45) {
      console.log('⚠️ DB active connections high → Optimize queries or investigate long-running transactions');
    }
    if (this.maxClientsErrorCount === 0 && avgCacheHitRate > 60 && maxDbActiveConns < 45) {
      console.log('✅ All metrics healthy - continue monitoring');
    }
    console.log('');
  }
}

// Run monitoring
const monitor = new PoolHealthMonitor();

// Default: 60s interval, 24h duration
// For testing: monitor.run(10, 300) // 10s interval, 5min duration
monitor.run(60, 86400).catch(err => {
  console.error('Monitoring failed:', err);
  process.exit(1);
});

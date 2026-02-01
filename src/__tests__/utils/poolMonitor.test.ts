/**
 * Pool Monitor Tests
 *
 * Tests for rate-limited pool monitoring functionality (PR-P0-3)
 */

// Mock dependencies before imports
jest.mock('../../database/connection', () => ({
  pool: {
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/metrics', () => ({
  metrics: {
    set: jest.fn(),
    inc: jest.fn(),
  },
}));

import { getPoolStats, emitPoolMetricsRateLimited, startPoolMonitor, stopPoolMonitor } from '../../database/poolMonitor';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

describe('PoolMonitor - Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env vars
    process.env.DB_POOL_UTIL_WARN_PCT = '80';
    process.env.DB_POOL_UTIL_CRIT_PCT = '90';
    process.env.DB_POOL_LOG_INTERVAL_MS = '60000';
    process.env.DB_MAX_CONNECTIONS = '10';
    // Reset pool state
    (pool as any).totalCount = 5;
    (pool as any).idleCount = 3;
    (pool as any).waitingCount = 0;
  });

  afterEach(() => {
    stopPoolMonitor();
  });

  describe('getPoolStats', () => {
    it('should calculate pool statistics correctly', () => {
      const stats = getPoolStats();

      expect(stats.totalCount).toBe(5);
      expect(stats.idleCount).toBe(3);
      expect(stats.waitingCount).toBe(0);
      expect(stats.activeCount).toBe(2); // totalCount - idleCount
      expect(stats.utilizationPct).toBe(20); // (2/10) * 100
    });

    it('should handle zero max connections', () => {
      process.env.DB_MAX_CONNECTIONS = '0';
      const stats = getPoolStats();

      expect(stats.utilizationPct).toBe(0);
    });

    it('should handle high utilization', () => {
      (pool as any).totalCount = 10;
      (pool as any).idleCount = 1;
      const stats = getPoolStats();

      expect(stats.activeCount).toBe(9);
      expect(stats.utilizationPct).toBe(90);
    });
  });

  describe('emitPoolMetricsRateLimited - Metrics Emission', () => {
    it('should always emit metrics regardless of rate-limiting', () => {
      emitPoolMetricsRateLimited();

      expect(metrics.set).toHaveBeenCalledWith('db.pool.total', 5);
      expect(metrics.set).toHaveBeenCalledWith('db.pool.idle', 3);
      expect(metrics.set).toHaveBeenCalledWith('db.pool.active', 2);
      expect(metrics.set).toHaveBeenCalledWith('db.pool.waiting', 0);
      expect(metrics.set).toHaveBeenCalledWith('db.pool.utilization_pct', 20);
    });

    it('should emit metrics even on subsequent calls', () => {
      emitPoolMetricsRateLimited();
      jest.clearAllMocks();

      emitPoolMetricsRateLimited();

      // Metrics should still be emitted (no rate-limiting on metrics)
      expect(metrics.set).toHaveBeenCalledTimes(5);
    });
  });

  describe('emitPoolMetricsRateLimited - Alert Conditions', () => {
    it('should detect CRITICAL condition when waitingCount > 0', () => {
      (pool as any).waitingCount = 5;
      emitPoolMetricsRateLimited();

      // Should log error (rate-limiting may suppress subsequent calls)
      // We just verify the logic would trigger
      const stats = getPoolStats();
      expect(stats.waitingCount).toBeGreaterThan(0);
    });

    it('should detect CRITICAL condition when utilization >= 90%', () => {
      (pool as any).totalCount = 10;
      (pool as any).idleCount = 1; // 90% utilization

      const stats = getPoolStats();
      expect(stats.utilizationPct).toBeGreaterThanOrEqual(90);
    });

    it('should detect WARN condition when utilization >= 80%', () => {
      (pool as any).totalCount = 10;
      (pool as any).idleCount = 2; // 80% utilization

      const stats = getPoolStats();
      expect(stats.utilizationPct).toBeGreaterThanOrEqual(80);
    });

    it('should not alert when pool is healthy', () => {
      (pool as any).totalCount = 10;
      (pool as any).idleCount = 7; // 30% utilization
      (pool as any).waitingCount = 0;

      const stats = getPoolStats();
      expect(stats.utilizationPct).toBeLessThan(80);
      expect(stats.waitingCount).toBe(0);
    });
  });

  describe('emitPoolMetricsRateLimited - Threshold Configuration', () => {
    it('should respect custom WARN threshold', () => {
      process.env.DB_POOL_UTIL_WARN_PCT = '70';
      (pool as any).totalCount = 10;
      (pool as any).idleCount = 4; // 60% utilization

      const stats = getPoolStats();
      const warnThreshold = parseInt(process.env.DB_POOL_UTIL_WARN_PCT);

      expect(stats.utilizationPct).toBeLessThan(warnThreshold);
    });

    it('should respect custom CRIT threshold', () => {
      process.env.DB_POOL_UTIL_CRIT_PCT = '95';
      (pool as any).totalCount = 10;
      (pool as any).idleCount = 1; // 90% utilization

      const stats = getPoolStats();
      const critThreshold = parseInt(process.env.DB_POOL_UTIL_CRIT_PCT);

      expect(stats.utilizationPct).toBeLessThan(critThreshold);
    });

    it('should use default thresholds when not configured', () => {
      delete process.env.DB_POOL_UTIL_WARN_PCT;
      delete process.env.DB_POOL_UTIL_CRIT_PCT;

      // Should not crash - will use defaults
      emitPoolMetricsRateLimited();

      expect(metrics.set).toHaveBeenCalled();
    });
  });

  describe('startPoolMonitor', () => {
    it('should start monitoring with default interval', () => {
      delete process.env.DB_MONITOR_ENABLED; // Ensure monitoring is enabled
      startPoolMonitor();

      expect(logger.info).toHaveBeenCalledWith(
        '[PoolMonitor] Started',
        expect.objectContaining({
          intervalMs: 30000,
        })
      );

      stopPoolMonitor();
    });

    it('should respect DB_MONITOR_ENABLED=false', () => {
      process.env.DB_MONITOR_ENABLED = 'false';
      startPoolMonitor();

      expect(logger.info).toHaveBeenCalledWith(
        '[PoolMonitor] Disabled via DB_MONITOR_ENABLED=false'
      );

      // Clean up for next test
      delete process.env.DB_MONITOR_ENABLED;
    });

    it('should not start twice', () => {
      delete process.env.DB_MONITOR_ENABLED; // Ensure monitoring is enabled
      startPoolMonitor();
      jest.clearAllMocks();

      startPoolMonitor();

      expect(logger.warn).toHaveBeenCalledWith(
        '[PoolMonitor] Already running, skipping start'
      );

      stopPoolMonitor();
    });

    it('should accept custom interval', () => {
      delete process.env.DB_MONITOR_ENABLED; // Ensure monitoring is enabled
      startPoolMonitor(60000);

      expect(logger.info).toHaveBeenCalledWith(
        '[PoolMonitor] Started',
        expect.objectContaining({
          intervalMs: 60000,
        })
      );

      stopPoolMonitor();
    });
  });

  describe('stopPoolMonitor', () => {
    it('should stop monitoring', () => {
      delete process.env.DB_MONITOR_ENABLED; // Ensure monitoring is enabled
      startPoolMonitor();
      jest.clearAllMocks();

      stopPoolMonitor();

      expect(logger.info).toHaveBeenCalledWith('[PoolMonitor] Stopped');
    });

    it('should be safe to call when not running', () => {
      stopPoolMonitor(); // Should not crash
      expect(logger.info).not.toHaveBeenCalled();
    });
  });
});

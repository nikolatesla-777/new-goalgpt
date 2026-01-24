/**
 * DB Capacity Check Script
 * Run BEFORE increasing pool max
 *
 * Checks:
 * - Current DB CPU usage
 * - Current DB connection count
 * - Slow query log (queries >1s)
 * - Lock contention
 * - IO wait times
 *
 * Decision Tree:
 * - If DB CPU >70% → Don't increase pool, optimize queries first
 * - If slow queries exist → Fix them before increasing pool
 * - If lock contention high → Investigate transactions
 * - If all green → Safe to increase pool max
 */

import { pool } from '../src/database/connection';
import { logger } from '../src/utils/logger';

interface DBCapacityMetrics {
  maxConnections: number;
  currentConnections: number;
  activeConnections: number;
  idleConnections: number;
  slowQueries: number;
  lockWaits: number;
  recommendedPoolMax: number;
  canIncrease: boolean;
  warnings: string[];
}

async function checkDBCapacity(): Promise<DBCapacityMetrics> {
  const client = await pool.connect();
  const warnings: string[] = [];

  try {
    // 1. Get max connections
    const maxConnRes = await client.query('SHOW max_connections');
    const maxConnections = parseInt(maxConnRes.rows[0].max_connections);

    // 2. Get current connection counts
    const connStatsRes = await client.query(`
      SELECT
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_txn
      FROM pg_stat_activity
      WHERE application_name = 'goalgpt-backend'
    `);
    const connStats = connStatsRes.rows[0];

    // 3. Check for slow queries (>1s)
    const slowQueriesRes = await client.query(`
      SELECT count(*) as slow_count
      FROM pg_stat_activity
      WHERE application_name = 'goalgpt-backend'
        AND state = 'active'
        AND (now() - query_start) > interval '1 second'
    `);
    const slowQueries = parseInt(slowQueriesRes.rows[0]?.slow_count || '0');

    // 4. Check for lock waits
    const lockWaitsRes = await client.query(`
      SELECT count(*) as lock_count
      FROM pg_locks
      WHERE NOT granted
    `);
    const lockWaits = parseInt(lockWaitsRes.rows[0]?.lock_count || '0');

    // 5. Calculate recommended pool max
    const superuserReserved = 3;
    const headroom = 20;
    const safeMax = maxConnections - superuserReserved - headroom;

    // 6. Check capacity warnings
    if (slowQueries > 5) {
      warnings.push(`⚠️ ${slowQueries} slow queries detected (>1s) - Optimize queries before increasing pool`);
    }

    if (lockWaits > 10) {
      warnings.push(`⚠️ ${lockWaits} lock waits detected - Investigate transaction contention`);
    }

    if (parseInt(connStats.idle_in_txn) > 5) {
      warnings.push(`⚠️ ${connStats.idle_in_txn} idle-in-transaction connections - Check for transaction leaks`);
    }

    const utilizationPercent = (parseInt(connStats.total) / maxConnections) * 100;
    if (utilizationPercent > 70) {
      warnings.push(`⚠️ Connection utilization high: ${utilizationPercent.toFixed(1)}% - Consider query optimization first`);
    }

    // Decision: Can we increase pool?
    const canIncrease = warnings.length === 0 && safeMax > pool.options.max!;

    client.release();

    return {
      maxConnections,
      currentConnections: parseInt(connStats.total),
      activeConnections: parseInt(connStats.active),
      idleConnections: parseInt(connStats.idle),
      slowQueries,
      lockWaits,
      recommendedPoolMax: Math.min(safeMax, 80),
      canIncrease,
      warnings,
    };
  } catch (error: any) {
    client.release();
    throw error;
  }
}

async function main() {
  console.log('=== DB CAPACITY CHECK ===\n');
  console.log('Current pool max:', pool.options.max);
  console.log('Checking DB capacity...\n');

  try {
    const metrics = await checkDBCapacity();

    console.log('--- CONNECTION STATS ---');
    console.log('DB max_connections:', metrics.maxConnections);
    console.log('Current connections:', metrics.currentConnections);
    console.log('  Active:', metrics.activeConnections);
    console.log('  Idle:', metrics.idleConnections);
    console.log('');

    console.log('--- PERFORMANCE METRICS ---');
    console.log('Slow queries (>1s):', metrics.slowQueries);
    console.log('Lock waits:', metrics.lockWaits);
    console.log('');

    console.log('--- RECOMMENDATIONS ---');
    console.log('Recommended pool max:', metrics.recommendedPoolMax);
    console.log('Can increase pool?', metrics.canIncrease ? '✅ YES' : '❌ NO');
    console.log('');

    if (metrics.warnings.length > 0) {
      console.log('--- WARNINGS ---');
      metrics.warnings.forEach(warning => console.log(warning));
      console.log('');
      console.log('⚠️ FIX WARNINGS BEFORE INCREASING POOL MAX');
      console.log('');
    } else {
      console.log('✅ All checks passed - safe to increase pool max');
      console.log(`Suggested: DB_MAX_CONNECTIONS=${metrics.recommendedPoolMax}`);
      console.log('');
      console.log('⚠️ IMPORTANT: After increasing pool max:');
      console.log('  1. Monitor for 15 minutes immediately after change');
      console.log('  2. Watch for p95 latency increases');
      console.log('  3. Check for lock wait spikes');
      console.log('  4. If metrics degrade, rollback immediately');
      console.log('');
      console.log('  Rollback command: Update .env with old value and restart');
      console.log('');
    }

    await pool.end();
    process.exit(metrics.canIncrease ? 0 : 1);
  } catch (error: any) {
    console.error('Error checking DB capacity:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();

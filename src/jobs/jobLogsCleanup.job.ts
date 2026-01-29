/**
 * Job Logs Cleanup Job - PHASE-0.1
 *
 * Schedule: Daily at 05:00 UTC
 * Purpose: Delete old job execution logs to prevent table bloat
 *
 * RETENTION: 30 days (configurable via RETENTION_DAYS)
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { jobRunner } from './framework/JobRunner';

// Retention period in days
const RETENTION_DAYS = 30;

/**
 * Run job logs cleanup
 * Deletes job_execution_logs older than RETENTION_DAYS
 */
export async function runJobLogsCleanup(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'jobLogsCleanup',
      overlapGuard: true,
      advisoryLockKey: 910000000100n, // Unique lock key
      timeoutMs: 60000, // 1 minute timeout
    },
    async (_ctx) => {
      logger.info(`[JobLogsCleanup] Starting cleanup (retention: ${RETENTION_DAYS} days)...`);

      const client = await pool.connect();
      try {
        // Delete old logs
        const result = await client.query(`
          DELETE FROM job_execution_logs
          WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
        `);

        const deletedCount = result.rowCount || 0;

        if (deletedCount > 0) {
          logger.info(`[JobLogsCleanup] ✅ Deleted ${deletedCount} old log entries`);
        } else {
          logger.debug('[JobLogsCleanup] No old logs to delete');
        }

        // Log table stats for monitoring
        const statsResult = await client.query(`
          SELECT
            COUNT(*) as total_logs,
            MIN(created_at) as oldest_log,
            MAX(created_at) as newest_log
          FROM job_execution_logs
        `);

        const stats = statsResult.rows[0];
        logger.info('[JobLogsCleanup] Table stats:', {
          total_logs: stats.total_logs,
          oldest_log: stats.oldest_log,
          newest_log: stats.newest_log,
          retention_days: RETENTION_DAYS,
        });

      } finally {
        client.release();
      }
    }
  );
}

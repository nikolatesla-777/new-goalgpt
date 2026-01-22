/**
 * JobRunner - Standardized Job Execution Framework
 *
 * PR-7: Job Framework
 *
 * Features:
 * - Overlap guard (prevents concurrent runs of same job)
 * - Advisory lock (PostgreSQL pg_try_advisory_lock)
 * - Timeout wrapper with configurable duration
 * - Structured metrics collection
 * - Try/finally cleanup guarantee
 *
 * Usage:
 * ```typescript
 * const result = await jobRunner.run({
 *   jobName: 'matchWatchdog',
 *   overlapGuard: true,
 *   advisoryLockKey: LOCK_KEYS.MATCH_WATCHDOG,
 *   timeoutMs: 25_000,
 * }, async (ctx) => {
 *   // Job logic here
 *   return { processed: 10 };
 * });
 * ```
 */

import crypto from 'crypto';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

// ============================================================
// TYPES
// ============================================================

export interface JobContext {
  jobName: string;
  runId: string;
  startedAt: number;
  /** Abort signal for cancellation support */
  signal?: AbortSignal;
}

export interface JobOptions {
  /** Unique name for the job (used in logs and metrics) */
  jobName: string;
  /** If true, skip this run if job is already running */
  overlapGuard: boolean;
  /** PostgreSQL advisory lock key (bigint) */
  advisoryLockKey: bigint;
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  /** Optional: Custom logger instance */
  customLogger?: typeof logger;
}

export interface JobResult<T> {
  status: 'success' | 'skipped_overlap' | 'skipped_lock' | 'timeout' | 'error';
  data?: T;
  error?: Error;
  durationMs: number;
  runId: string;
}

// ============================================================
// JOB RUNNER CLASS
// ============================================================

export class JobRunner {
  private running = new Set<string>();

  /**
   * Execute a job with standardized guards and metrics
   *
   * @param opts - Job configuration options
   * @param fn - The job function to execute
   * @returns Job result with status and optional data
   */
  async run<T>(
    opts: JobOptions,
    fn: (ctx: JobContext) => Promise<T>
  ): Promise<JobResult<T>> {
    const { jobName, overlapGuard, advisoryLockKey, timeoutMs, customLogger } = opts;
    const log = customLogger || logger;
    const runId = crypto.randomUUID();
    const startedAt = Date.now();

    // ========================================
    // OVERLAP GUARD
    // ========================================
    if (overlapGuard && this.running.has(jobName)) {
      log.warn({ jobName, runId }, '[JobRunner] Overlap guard triggered, skipping run');
      metrics.inc('job.skipped_overlap', { jobName });
      return {
        status: 'skipped_overlap',
        durationMs: 0,
        runId,
      };
    }

    this.running.add(jobName);
    let lockAcquired = false;

    try {
      // ========================================
      // ADVISORY LOCK (non-blocking)
      // ========================================
      try {
        const lockResult = await pool.query(
          'SELECT pg_try_advisory_lock($1) AS ok',
          [advisoryLockKey.toString()]
        );
        lockAcquired = lockResult?.rows?.[0]?.ok === true;
      } catch (lockError) {
        log.error({ jobName, runId, error: lockError }, '[JobRunner] Failed to acquire advisory lock');
        lockAcquired = false;
      }

      if (!lockAcquired) {
        log.warn({ jobName, runId }, '[JobRunner] Advisory lock not acquired, skipping run');
        metrics.inc('job.skipped_lock', { jobName });
        return {
          status: 'skipped_lock',
          durationMs: Date.now() - startedAt,
          runId,
        };
      }

      // ========================================
      // JOB EXECUTION WITH TIMEOUT
      // ========================================
      metrics.inc('job.started', { jobName });
      log.info({ jobName, runId, timeoutMs }, '[JobRunner] Job started');

      const ctx: JobContext = {
        jobName,
        runId,
        startedAt,
      };

      // Create timeout promise
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`JOB_TIMEOUT: ${jobName} exceeded ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        // Race between job and timeout
        const result = await Promise.race([
          fn(ctx),
          timeoutPromise,
        ]);

        // Clear timeout on success
        clearTimeout(timeoutId!);

        const durationMs = Date.now() - startedAt;
        metrics.inc('job.success', { jobName });
        metrics.observe('job.duration_ms', durationMs, { jobName });
        log.info({ jobName, runId, durationMs }, '[JobRunner] Job completed successfully');

        return {
          status: 'success',
          data: result,
          durationMs,
          runId,
        };
      } catch (error: any) {
        clearTimeout(timeoutId!);

        const durationMs = Date.now() - startedAt;
        const isTimeout = error.message?.includes('JOB_TIMEOUT');

        if (isTimeout) {
          metrics.inc('job.timeout', { jobName });
          log.error({ jobName, runId, durationMs }, '[JobRunner] Job timed out');
          return {
            status: 'timeout',
            error,
            durationMs,
            runId,
          };
        }

        metrics.inc('job.failure', { jobName });
        log.error({ jobName, runId, durationMs, error: error.message }, '[JobRunner] Job failed');

        return {
          status: 'error',
          error,
          durationMs,
          runId,
        };
      }
    } finally {
      // ========================================
      // CLEANUP: Release lock and overlap guard
      // ========================================
      if (lockAcquired) {
        try {
          await pool.query(
            'SELECT pg_advisory_unlock($1)',
            [advisoryLockKey.toString()]
          );
        } catch (unlockError) {
          log.error({ jobName, runId, error: unlockError }, '[JobRunner] Failed to release advisory lock');
        }
      }

      this.running.delete(jobName);
    }
  }

  /**
   * Check if a job is currently running
   */
  isJobRunning(jobName: string): boolean {
    return this.running.has(jobName);
  }

  /**
   * Get list of currently running jobs
   */
  getRunningJobs(): string[] {
    return Array.from(this.running);
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const jobRunner = new JobRunner();

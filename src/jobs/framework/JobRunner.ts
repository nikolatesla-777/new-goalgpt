/**
 * JobRunner - Standardized Job Execution Framework
 *
 * PR-7: Job Framework
 * PR-9: CRITICAL FIX - Advisory lock now uses same connection for lock/unlock
 *
 * Features:
 * - Overlap guard (prevents concurrent runs of same job)
 * - Advisory lock (PostgreSQL pg_try_advisory_lock) - SESSION-BOUND
 * - Timeout wrapper with configurable duration
 * - Structured metrics collection
 * - Try/finally cleanup guarantee
 *
 * CRITICAL FIX (PR-9):
 * Previously, pool.query() was used for advisory locks. This is BROKEN because:
 * - pool.query() borrows a random connection, executes, returns it
 * - Lock acquired on Connection A, released on Connection B
 * - Lock on Connection A is NEVER released
 *
 * Now uses withAdvisoryLock() which holds SAME connection for entire lock duration.
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
import { withAdvisoryLock } from '../../database/connectionHelpers';
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
   * PR-9 CRITICAL: Uses withAdvisoryLock() for session-bound locking.
   * The advisory lock is acquired and released on the SAME connection.
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
    // OVERLAP GUARD (in-memory, same process)
    // ========================================
    if (overlapGuard && this.running.has(jobName)) {
      log.warn(`[JobRunner] Overlap guard triggered, skipping run`, { jobName, runId });
      metrics.inc('job.skipped_overlap', { jobName });
      return {
        status: 'skipped_overlap',
        durationMs: 0,
        runId,
      };
    }

    this.running.add(jobName);

    try {
      // ========================================
      // ADVISORY LOCK + JOB EXECUTION
      // PR-9: Uses withAdvisoryLock for session-bound locking
      // ========================================
      const lockResult = await withAdvisoryLock(
        advisoryLockKey,
        async () => {
          // Job execution happens WITHIN the lock
          // The connection that acquired the lock is held until this returns

          metrics.inc('job.started', { jobName });
          log.info(`[JobRunner] Job started`, { jobName, runId, timeoutMs });

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
            log.info(`[JobRunner] Job completed successfully`, { jobName, runId, durationMs });

            return {
              status: 'success' as const,
              data: result,
              durationMs,
            };
          } catch (error: any) {
            clearTimeout(timeoutId!);

            const durationMs = Date.now() - startedAt;
            const isTimeout = error.message?.includes('JOB_TIMEOUT');

            if (isTimeout) {
              metrics.inc('job.timeout', { jobName });
              log.error(`[JobRunner] Job timed out`, { jobName, runId, durationMs });
              return {
                status: 'timeout' as const,
                error,
                durationMs,
              };
            }

            metrics.inc('job.failure', { jobName });
            log.error(`[JobRunner] Job failed`, { jobName, runId, durationMs, error: error.message });

            return {
              status: 'error' as const,
              error,
              durationMs,
            };
          }
        },
        {
          blocking: false, // Non-blocking - skip if lock held
          timeoutMs: timeoutMs * 2, // 2x buffer for safety
        }
      );

      // ========================================
      // HANDLE LOCK RESULT
      // ========================================
      if (!lockResult.acquired) {
        log.warn(`[JobRunner] Advisory lock not acquired, skipping run`, { jobName, runId });
        metrics.inc('job.skipped_lock', { jobName });
        return {
          status: 'skipped_lock',
          durationMs: Date.now() - startedAt,
          runId,
        };
      }

      // Return the result from within the lock
      return {
        ...lockResult.result!,
        runId,
      };
    } finally {
      // ========================================
      // CLEANUP: Remove from overlap guard
      // Note: Advisory lock is released by withAdvisoryLock
      // ========================================
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

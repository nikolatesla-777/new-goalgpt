/**
 * Connection Helpers - Safe Database Connection Management
 *
 * PR-9: DB Connection Safety
 *
 * Provides:
 * - withClient(): Safe connection acquisition with guaranteed release
 * - withTransaction(): Auto commit/rollback transaction wrapper
 * - withAdvisoryLock(): Session-bound advisory locks (CRITICAL FIX)
 *
 * CRITICAL: Advisory locks are session-bound (connection-bound).
 * Using pool.query() for locks is BROKEN because:
 * - Lock acquired on Connection A
 * - Lock released on Connection B (different connection!)
 * - Lock on Connection A is NEVER released
 *
 * withAdvisoryLock() solves this by holding the SAME connection
 * for the entire lock duration.
 */

import { Pool, PoolClient } from 'pg';
import { pool } from './connection';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// ============================================================
// TYPES
// ============================================================

export interface WithClientOptions {
  /** Number of retry attempts on connection errors (default: 0) */
  retries?: number;
  /** Delay between retries in ms (default: 500) */
  retryDelayMs?: number;
  /** Timeout for acquiring connection in ms (uses pool default if not set) */
  acquireTimeoutMs?: number;
}

export interface WithAdvisoryLockOptions {
  /** Use blocking lock (pg_advisory_lock) vs non-blocking (pg_try_advisory_lock) */
  blocking?: boolean;
  /** Timeout for the entire operation in ms (default: 60000) */
  timeoutMs?: number;
}

export interface AdvisoryLockResult<T> {
  /** Whether the lock was successfully acquired */
  acquired: boolean;
  /** Result of the callback (only set if acquired) */
  result?: T;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if an error is retriable (connection-related)
 */
function isRetriableError(err: any): boolean {
  return (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.code === '57P01' || // admin_shutdown
    err.code === '57P02' || // crash_shutdown
    err.code === '57P03' || // cannot_connect_now
    err.message?.includes('Connection terminated') ||
    err.message?.includes('timeout') ||
    err.message?.includes('connect') ||
    err.message?.includes('ECONNRESET')
  );
}

/**
 * Sleep helper
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================
// withClient - Safe Connection Management
// ============================================================

/**
 * Execute a callback with a safely managed database client.
 * Guarantees client release even on error.
 *
 * @param fn - Callback that receives a PoolClient
 * @param options - Optional retry configuration
 * @returns Result of callback
 *
 * @example
 * ```typescript
 * const users = await withClient(async (client) => {
 *   const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
 *   return result.rows;
 * });
 * ```
 */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
  options?: WithClientOptions
): Promise<T> {
  const { retries = 0, retryDelayMs = 500 } = options ?? {};
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const acquireStart = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      // Log slow acquisitions (> 1000ms)
      const acquireDuration = Date.now() - acquireStart;
      if (acquireDuration > 1000) {
        logger.warn(`[withClient] Slow connection acquisition: ${acquireDuration}ms`);
        metrics.inc('db.pool.slow_acquire', { threshold: '1000ms' });
      }

      const result = await fn(client);
      client.release();
      return result;
    } catch (err: any) {
      lastError = err;

      if (client) {
        try {
          // Release with error flag to destroy connection on connection errors
          const shouldDestroy = isRetriableError(err);
          client.release(shouldDestroy);
        } catch (releaseErr) {
          logger.warn('[withClient] Client release error:', { error: releaseErr });
        }
      }

      // Only retry on connection errors
      if (!isRetriableError(err) || attempt === retries) {
        throw err;
      }

      logger.warn(`[withClient] Retrying (${attempt + 1}/${retries})...`, {
        error: err.message,
      });
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

// ============================================================
// withTransaction - Transactional Operations
// ============================================================

/**
 * Execute a callback within a database transaction.
 * Auto-commits on success, auto-rollbacks on error.
 *
 * @param fn - Callback that receives a PoolClient (within transaction)
 * @returns Result of callback
 *
 * @example
 * ```typescript
 * await withTransaction(async (client) => {
 *   await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
 *   await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withClient(async (client) => {
    await client.query('BEGIN');

    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error('[withTransaction] Rollback failed:', { error: rollbackErr });
      }
      throw err;
    }
  });
}

// ============================================================
// withAdvisoryLock - Session-Bound Advisory Locks (CRITICAL)
// ============================================================

/**
 * Execute a callback while holding a PostgreSQL advisory lock.
 *
 * CRITICAL: Uses SAME connection for lock/unlock (session-bound).
 * This fixes the broken pattern where pool.query() acquires lock on
 * one connection and releases on another (lock never released).
 *
 * @param lockKey - BigInt advisory lock key
 * @param fn - Callback to execute while holding lock
 * @param options - Timeout and blocking options
 * @returns Object with acquired status and optional result
 *
 * @example
 * ```typescript
 * const result = await withAdvisoryLock(
 *   LOCK_KEYS.MATCH_WATCHDOG,
 *   async () => {
 *     // This code runs while holding the lock
 *     return await processMatches();
 *   },
 *   { blocking: false, timeoutMs: 30000 }
 * );
 *
 * if (!result.acquired) {
 *   console.log('Lock was held by another process');
 * }
 * ```
 */
export async function withAdvisoryLock<T>(
  lockKey: bigint,
  fn: () => Promise<T>,
  options?: WithAdvisoryLockOptions
): Promise<AdvisoryLockResult<T>> {
  const { blocking = false, timeoutMs = 60_000 } = options ?? {};

  // Get a SINGLE client and hold it for entire duration
  // This is CRITICAL - advisory locks are session-bound
  const acquireStart = Date.now();
  const client = await pool.connect();
  let lockAcquired = false;

  // Log slow acquisitions
  const acquireDuration = Date.now() - acquireStart;
  if (acquireDuration > 1000) {
    logger.warn(`[withAdvisoryLock] Slow connection acquisition: ${acquireDuration}ms`);
  }

  try {
    // Acquire lock on THIS connection
    const lockFn = blocking ? 'pg_advisory_lock' : 'pg_try_advisory_lock';
    const lockResult = await client.query(
      `SELECT ${lockFn}($1) AS ok`,
      [lockKey.toString()]
    );

    // For blocking locks, success is implicit (would block until acquired)
    // For non-blocking locks, check the return value
    lockAcquired = blocking ? true : (lockResult.rows[0]?.ok === true);

    if (!lockAcquired) {
      // Lock not acquired - release client and return
      client.release();
      return { acquired: false };
    }

    metrics.inc('db.advisory_lock.acquired', { blocking: String(blocking) });

    // Execute callback with timeout
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`ADVISORY_LOCK_TIMEOUT: Operation exceeded ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timeoutId);
      return { acquired: true, result };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.message?.includes('ADVISORY_LOCK_TIMEOUT')) {
        metrics.inc('db.advisory_lock.timeout', { lockKey: lockKey.toString() });
        logger.error(`[withAdvisoryLock] Operation timed out`, { lockKey: lockKey.toString(), timeoutMs });
      }

      throw err;
    }
  } finally {
    // CRITICAL: Release lock on SAME connection that acquired it
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey.toString()]);
        metrics.inc('db.advisory_lock.released', { lockKey: lockKey.toString() });
      } catch (unlockErr) {
        // Log but don't throw - the connection will be destroyed anyway
        logger.error(`[withAdvisoryLock] Failed to release lock ${lockKey}:`, { error: unlockErr });
        metrics.inc('db.advisory_lock.release_failed', { lockKey: lockKey.toString() });
      }
    }

    // Release client back to pool
    try {
      client.release();
    } catch (releaseErr) {
      logger.warn('[withAdvisoryLock] Client release error:', { error: releaseErr });
    }
  }
}

// ============================================================
// Batch Query Helper
// ============================================================

/**
 * Execute multiple queries in a single connection (reduces pool pressure)
 *
 * @param queries - Array of {text, params} query objects
 * @returns Array of result rows for each query
 */
export async function batchQuery<T = any>(
  queries: Array<{ text: string; params?: any[] }>
): Promise<T[][]> {
  return withClient(async (client) => {
    const results: T[][] = [];

    for (const query of queries) {
      const result = await client.query(query.text, query.params);
      results.push(result.rows as T[]);
    }

    return results;
  });
}

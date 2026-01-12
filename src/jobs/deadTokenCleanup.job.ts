/**
 * Dead Token Cleanup Job
 *
 * Schedule: Weekly Sunday at 03:00 (3 AM)
 * Purpose: Remove expired/invalid FCM tokens from database
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';

export async function runDeadTokenCleanup() {
  const jobName = 'Dead Token Cleanup';
  const startTime = Date.now();
  let processedCount = 0;
  let logId: string | null = null;

  try {
    // Log job start
    const logResult = await db
      .insertInto('job_execution_logs')
      .values({
        job_name: jobName,
        started_at: sql`NOW()`,
        status: 'running',
      })
      .returning('id')
      .executeTakeFirst();

    logId = logResult?.id || null;

    // Cutoff date: 90 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    logger.info(`Cleaning up tokens not used since ${cutoffDate.toISOString()}`);

    // Delete tokens that:
    // 1. Haven't been updated in 90 days (not used)
    // 2. OR marked as inactive (failed sends)
    const deletedTokens = await db
      .deleteFrom('customer_push_tokens')
      .where((eb) =>
        eb.or([
          eb('updated_at', '<', cutoffDate),
          eb('is_active', '=', false),
        ])
      )
      .executeTakeFirst();

    processedCount = Number(deletedTokens.numDeletedRows || 0);

    // Log statistics
    const totalRemainingTokens = await db
      .selectFrom('customer_push_tokens')
      .select(sql<number>`COUNT(*)`.as('count'))
      .executeTakeFirst();

    const activeTokens = await db
      .selectFrom('customer_push_tokens')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('is_active', '=', true)
      .executeTakeFirst();

    logger.info(`Token cleanup stats:`);
    logger.info(`  - Deleted: ${processedCount} tokens`);
    logger.info(`  - Remaining: ${totalRemainingTokens?.count || 0} total`);
    logger.info(`  - Active: ${activeTokens?.count || 0} tokens`);

    // Log job success
    const duration = Date.now() - startTime;
    if (logId) {
      await db
        .updateTable('job_execution_logs')
        .set({
          completed_at: sql`NOW()`,
          status: 'success',
          items_processed: processedCount,
          duration_ms: duration,
        })
        .where('id', '=', logId)
        .execute();
    }

    logger.info(`${jobName}: Deleted ${processedCount} token(s) in ${duration}ms`);
  } catch (error: any) {
    // Log job failure
    const duration = Date.now() - startTime;
    if (logId) {
      await db
        .updateTable('job_execution_logs')
        .set({
          completed_at: sql`NOW()`,
          status: 'failed',
          items_processed: processedCount,
          error_message: error.message,
          duration_ms: duration,
        })
        .where('id', '=', logId)
        .execute();
    }

    logger.error(`${jobName} failed:`, error);
    throw error;
  }
}

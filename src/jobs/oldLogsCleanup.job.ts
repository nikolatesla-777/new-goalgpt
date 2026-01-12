/**
 * Old Logs Cleanup Job
 *
 * Schedule: Monthly on 1st at 04:00 (4 AM)
 * Purpose: Archive/delete old transaction logs to optimize database
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';

// Retention policy (days)
const RETENTION_POLICY = {
  customer_xp_transactions: 365, // 1 year
  customer_credit_transactions: 365, // 1 year
  customer_ad_views: 180, // 6 months
  match_comment_likes: 365, // 1 year
  scheduled_notifications: 90, // 3 months
  job_execution_logs: 90, // 3 months
};

export async function runOldLogsCleanup() {
  const jobName = 'Old Logs Cleanup';
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

    const totalDeleted = {
      xp_transactions: 0,
      credit_transactions: 0,
      ad_views: 0,
      comment_likes: 0,
      notifications: 0,
      job_logs: 0,
    };

    // Clean customer_xp_transactions
    const xpCutoff = new Date();
    xpCutoff.setDate(xpCutoff.getDate() - RETENTION_POLICY.customer_xp_transactions);

    const deletedXP = await db
      .deleteFrom('customer_xp_transactions')
      .where('created_at', '<', xpCutoff)
      .executeTakeFirst();

    totalDeleted.xp_transactions = Number(deletedXP.numDeletedRows || 0);
    logger.info(`Deleted ${totalDeleted.xp_transactions} XP transaction(s) older than ${RETENTION_POLICY.customer_xp_transactions} days`);

    // Clean customer_credit_transactions
    const creditCutoff = new Date();
    creditCutoff.setDate(creditCutoff.getDate() - RETENTION_POLICY.customer_credit_transactions);

    const deletedCredits = await db
      .deleteFrom('customer_credit_transactions')
      .where('created_at', '<', creditCutoff)
      .executeTakeFirst();

    totalDeleted.credit_transactions = Number(deletedCredits.numDeletedRows || 0);
    logger.info(`Deleted ${totalDeleted.credit_transactions} credit transaction(s) older than ${RETENTION_POLICY.customer_credit_transactions} days`);

    // Clean customer_ad_views
    const adCutoff = new Date();
    adCutoff.setDate(adCutoff.getDate() - RETENTION_POLICY.customer_ad_views);

    const deletedAds = await db
      .deleteFrom('customer_ad_views')
      .where('completed_at', '<', adCutoff)
      .executeTakeFirst();

    totalDeleted.ad_views = Number(deletedAds.numDeletedRows || 0);
    logger.info(`Deleted ${totalDeleted.ad_views} ad view(s) older than ${RETENTION_POLICY.customer_ad_views} days`);

    // Clean match_comment_likes
    const likesCutoff = new Date();
    likesCutoff.setDate(likesCutoff.getDate() - RETENTION_POLICY.match_comment_likes);

    const deletedLikes = await db
      .deleteFrom('match_comment_likes')
      .where('created_at', '<', likesCutoff)
      .executeTakeFirst();

    totalDeleted.comment_likes = Number(deletedLikes.numDeletedRows || 0);
    logger.info(`Deleted ${totalDeleted.comment_likes} comment like(s) older than ${RETENTION_POLICY.match_comment_likes} days`);

    // Clean scheduled_notifications (sent/failed only, keep pending)
    const notifCutoff = new Date();
    notifCutoff.setDate(notifCutoff.getDate() - RETENTION_POLICY.scheduled_notifications);

    const deletedNotifs = await db
      .deleteFrom('scheduled_notifications')
      .where('created_at', '<', notifCutoff)
      .where('status', 'in', ['sent', 'failed'])
      .executeTakeFirst();

    totalDeleted.notifications = Number(deletedNotifs.numDeletedRows || 0);
    logger.info(`Deleted ${totalDeleted.notifications} notification(s) older than ${RETENTION_POLICY.scheduled_notifications} days`);

    // Clean job_execution_logs (keep recent logs for monitoring)
    const jobLogsCutoff = new Date();
    jobLogsCutoff.setDate(jobLogsCutoff.getDate() - RETENTION_POLICY.job_execution_logs);

    const deletedJobLogs = await db
      .deleteFrom('job_execution_logs')
      .where('created_at', '<', jobLogsCutoff)
      .executeTakeFirst();

    totalDeleted.job_logs = Number(deletedJobLogs.numDeletedRows || 0);
    logger.info(`Deleted ${totalDeleted.job_logs} job log(s) older than ${RETENTION_POLICY.job_execution_logs} days`);

    // Calculate total
    processedCount = Object.values(totalDeleted).reduce((sum, count) => sum + count, 0);

    // Run VACUUM ANALYZE to reclaim space and update statistics
    try {
      // Note: VACUUM cannot run inside a transaction
      logger.info('Running VACUUM ANALYZE to reclaim space...');
      // This would need to be run separately outside transaction
      // For now, just log - admin can run manually if needed
      logger.info('VACUUM ANALYZE should be run manually: VACUUM ANALYZE;');
    } catch (vacuumError: any) {
      logger.warn('VACUUM skipped (requires manual run):', vacuumError.message);
    }

    // Log summary
    logger.info('=== Cleanup Summary ===');
    logger.info(`  XP Transactions: ${totalDeleted.xp_transactions}`);
    logger.info(`  Credit Transactions: ${totalDeleted.credit_transactions}`);
    logger.info(`  Ad Views: ${totalDeleted.ad_views}`);
    logger.info(`  Comment Likes: ${totalDeleted.comment_likes}`);
    logger.info(`  Notifications: ${totalDeleted.notifications}`);
    logger.info(`  Job Logs: ${totalDeleted.job_logs}`);
    logger.info(`  TOTAL: ${processedCount} records deleted`);

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

    logger.info(`${jobName}: Deleted ${processedCount} record(s) in ${duration}ms`);
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

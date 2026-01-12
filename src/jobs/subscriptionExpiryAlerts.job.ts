/**
 * Subscription Expiry Alerts Job
 *
 * Schedule: Daily at 10:00 (10 AM)
 * Purpose: Notify VIP users 3 days before subscription expires
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';
import { sendPushToUser } from '../services/push.service';

export async function runSubscriptionExpiryAlerts() {
  const jobName = 'Subscription Expiry Alerts';
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

    // Find subscriptions expiring in 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999); // End of that day

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(23, 59, 59, 999);

    // Find subscriptions expiring between 2-3 days from now
    const expiringSubscriptions = await db
      .selectFrom('customer_subscriptions as cs')
      .innerJoin('customer_users as cu', 'cs.customer_user_id', 'cu.id')
      .innerJoin('customer_push_tokens as cpt', 'cu.id', 'cpt.customer_user_id')
      .select([
        'cu.id as user_id',
        'cu.name',
        'cs.expired_at',
        'cs.platform',
        sql<number>`EXTRACT(DAY FROM (cs.expired_at - NOW()))`.as('days_remaining'),
      ])
      .where('cu.deleted_at', 'is', null)
      .where('cpt.is_active', '=', true)
      .where('cs.status', '=', 'active')
      .where('cs.expired_at', '>', twoDaysFromNow)
      .where('cs.expired_at', '<=', threeDaysFromNow)
      .groupBy(['cu.id', 'cu.name', 'cs.expired_at', 'cs.platform'])
      .execute();

    logger.info(`Found ${expiringSubscriptions.length} subscription(s) expiring in 3 days`);

    // Send alerts
    for (const subscription of expiringSubscriptions) {
      try {
        const daysRemaining = Math.ceil(Number(subscription.days_remaining));

        await sendPushToUser(subscription.user_id, {
          title: 'VIP Üyelik Uyarısı 👑',
          body: `VIP üyeliğin ${daysRemaining} gün sonra sona eriyor. Yenilemeyi unutma!`,
          data: {
            type: 'subscription_expiry',
            daysRemaining: String(daysRemaining),
            expiredAt: subscription.expired_at.toISOString(),
            platform: subscription.platform || 'unknown',
          },
          deepLink: 'goalgpt://paywall',
        });

        processedCount++;
      } catch (userError: any) {
        logger.error(`Error sending expiry alert to user ${subscription.user_id}:`, userError);
      }
    }

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

    logger.info(`${jobName}: Sent ${processedCount} alert(s) in ${duration}ms`);
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

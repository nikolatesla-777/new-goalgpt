/**
 * Partner Analytics Rollup Job
 *
 * Schedule: Daily at 00:05 (5 minutes after midnight)
 * Purpose: Aggregate yesterday's partner performance metrics
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';

export async function runPartnerAnalytics() {
  const jobName = 'Partner Analytics Rollup';
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

    // Get yesterday's date (UTC)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    // Get all active and approved partners
    const partners = await db
      .selectFrom('partners')
      .select(['id', 'referral_code', 'commission_rate'])
      .where('status', 'in', ['approved', 'active'])
      .execute();

    logger.info(`Processing analytics for ${partners.length} partner(s) for ${yesterday.toISOString().split('T')[0]}`);

    // Process each partner
    for (const partner of partners) {
      try {
        await db.transaction().execute(async (trx) => {
          // Count new signups (referrals created yesterday)
          const newSignups = await trx
            .selectFrom('referrals')
            .select(sql<number>`COUNT(*)`.as('count'))
            .where('referrer_user_id', '=', partner.id)
            .where('created_at', '>=', yesterday)
            .where('created_at', '<=', yesterdayEnd)
            .executeTakeFirst();

          // Count new subscriptions with partner code
          const newSubscriptions = await trx
            .selectFrom('customer_subscriptions')
            .select([
              sql<number>`COUNT(*)`.as('count'),
              sql<number>`SUM(CASE
                WHEN platform = 'ios' THEN 99.99
                WHEN platform = 'android' THEN 99.99
                ELSE 0
              END)`.as('revenue'),
            ])
            .where('referral_code', '=', partner.referral_code)
            .where('created_at', '>=', yesterday)
            .where('created_at', '<=', yesterdayEnd)
            .executeTakeFirst();

          const subscriptionCount = Number(newSubscriptions?.count || 0);
          const revenue = Number(newSubscriptions?.revenue || 0);
          const commission = (revenue * Number(partner.commission_rate)) / 100;

          // Count active subscribers (current active with partner code)
          const activeSubscribers = await trx
            .selectFrom('customer_subscriptions')
            .select(sql<number>`COUNT(*)`.as('count'))
            .where('referral_code', '=', partner.referral_code)
            .where('status', '=', 'active')
            .where('expired_at', '>', new Date())
            .executeTakeFirst();

          // Count churned users (subscriptions expired yesterday)
          const churnCount = await trx
            .selectFrom('customer_subscriptions')
            .select(sql<number>`COUNT(*)`.as('count'))
            .where('referral_code', '=', partner.referral_code)
            .where('expired_at', '>=', yesterday)
            .where('expired_at', '<=', yesterdayEnd)
            .where('status', '=', 'expired')
            .executeTakeFirst();

          // Insert analytics record
          await trx
            .insertInto('partner_analytics')
            .values({
              partner_id: partner.id,
              date: yesterday,
              new_signups: Number(newSignups?.count || 0),
              new_subscriptions: subscriptionCount,
              revenue: revenue.toFixed(2),
              commission: commission.toFixed(2),
              active_subscribers: Number(activeSubscribers?.count || 0),
              churn_count: Number(churnCount?.count || 0),
            })
            .onConflict((oc) =>
              oc.columns(['partner_id', 'date']).doUpdateSet({
                new_signups: sql`EXCLUDED.new_signups`,
                new_subscriptions: sql`EXCLUDED.new_subscriptions`,
                revenue: sql`EXCLUDED.revenue`,
                commission: sql`EXCLUDED.commission`,
                active_subscribers: sql`EXCLUDED.active_subscribers`,
                churn_count: sql`EXCLUDED.churn_count`,
              })
            )
            .execute();

          // Update partner totals
          await trx
            .updateTable('partners')
            .set({
              total_referrals: sql`total_referrals + ${Number(newSignups?.count || 0)}`,
              total_subscriptions: sql`total_subscriptions + ${subscriptionCount}`,
              total_revenue: sql`total_revenue + ${revenue}`,
              total_commission: sql`total_commission + ${commission}`,
            })
            .where('id', '=', partner.id)
            .execute();

          logger.debug(
            `Partner ${partner.id}: ${newSignups?.count} signups, ${subscriptionCount} subs, ${revenue.toFixed(2)} TL revenue, ${commission.toFixed(2)} TL commission`
          );
        });

        processedCount++;
      } catch (partnerError: any) {
        logger.error(`Error processing analytics for partner ${partner.id}:`, partnerError);
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

    logger.info(`${jobName}: Processed ${processedCount} partner(s) in ${duration}ms`);
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

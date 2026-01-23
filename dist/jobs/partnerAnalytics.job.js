"use strict";
/**
 * Partner Analytics Rollup Job
 *
 * Schedule: Daily at 00:05 (5 minutes after midnight)
 * Purpose: Aggregate yesterday's partner performance metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPartnerAnalytics = runPartnerAnalytics;
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
const kysely_2 = require("kysely");
async function runPartnerAnalytics() {
    const jobName = 'Partner Analytics Rollup';
    const startTime = Date.now();
    let processedCount = 0;
    let logId = null;
    try {
        // Log job start
        const logResult = await kysely_1.db
            .insertInto('job_execution_logs')
            .values({
            job_name: jobName,
            started_at: (0, kysely_2.sql) `NOW()`,
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
        const partners = await kysely_1.db
            .selectFrom('partners')
            .select(['id', 'referral_code', 'commission_rate'])
            .where('status', 'in', ['approved', 'active'])
            .execute();
        logger_1.logger.info(`Processing analytics for ${partners.length} partner(s) for ${yesterday.toISOString().split('T')[0]}`);
        // Process each partner
        for (const partner of partners) {
            try {
                await kysely_1.db.transaction().execute(async (trx) => {
                    // Count new signups (referrals created yesterday)
                    const newSignups = await trx
                        .selectFrom('referrals')
                        .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
                        .where('referrer_user_id', '=', partner.id)
                        .where('created_at', '>=', yesterday)
                        .where('created_at', '<=', yesterdayEnd)
                        .executeTakeFirst();
                    // Count new subscriptions with partner code
                    const newSubscriptions = await trx
                        .selectFrom('customer_subscriptions')
                        .select([
                        (0, kysely_2.sql) `COUNT(*)`.as('count'),
                        (0, kysely_2.sql) `SUM(CASE
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
                        .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
                        .where('referral_code', '=', partner.referral_code)
                        .where('status', '=', 'active')
                        .where('expired_at', '>', new Date())
                        .executeTakeFirst();
                    // Count churned users (subscriptions expired yesterday)
                    const churnCount = await trx
                        .selectFrom('customer_subscriptions')
                        .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
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
                        .onConflict((oc) => oc.columns(['partner_id', 'date']).doUpdateSet({
                        new_signups: (0, kysely_2.sql) `EXCLUDED.new_signups`,
                        new_subscriptions: (0, kysely_2.sql) `EXCLUDED.new_subscriptions`,
                        revenue: (0, kysely_2.sql) `EXCLUDED.revenue`,
                        commission: (0, kysely_2.sql) `EXCLUDED.commission`,
                        active_subscribers: (0, kysely_2.sql) `EXCLUDED.active_subscribers`,
                        churn_count: (0, kysely_2.sql) `EXCLUDED.churn_count`,
                    }))
                        .execute();
                    // Update partner totals
                    await trx
                        .updateTable('partners')
                        .set({
                        total_referrals: (0, kysely_2.sql) `total_referrals + ${Number(newSignups?.count || 0)}`,
                        total_subscriptions: (0, kysely_2.sql) `total_subscriptions + ${subscriptionCount}`,
                        total_revenue: (0, kysely_2.sql) `total_revenue + ${revenue}`,
                        total_commission: (0, kysely_2.sql) `total_commission + ${commission}`,
                    })
                        .where('id', '=', partner.id)
                        .execute();
                    logger_1.logger.debug(`Partner ${partner.id}: ${newSignups?.count} signups, ${subscriptionCount} subs, ${revenue.toFixed(2)} TL revenue, ${commission.toFixed(2)} TL commission`);
                });
                processedCount++;
            }
            catch (partnerError) {
                logger_1.logger.error(`Error processing analytics for partner ${partner.id}:`, partnerError);
            }
        }
        // Log job success
        const duration = Date.now() - startTime;
        if (logId) {
            await kysely_1.db
                .updateTable('job_execution_logs')
                .set({
                completed_at: (0, kysely_2.sql) `NOW()`,
                status: 'success',
                items_processed: processedCount,
                duration_ms: duration,
            })
                .where('id', '=', logId)
                .execute();
        }
        logger_1.logger.info(`${jobName}: Processed ${processedCount} partner(s) in ${duration}ms`);
    }
    catch (error) {
        // Log job failure
        const duration = Date.now() - startTime;
        if (logId) {
            await kysely_1.db
                .updateTable('job_execution_logs')
                .set({
                completed_at: (0, kysely_2.sql) `NOW()`,
                status: 'failed',
                items_processed: processedCount,
                error_message: error.message,
                duration_ms: duration,
            })
                .where('id', '=', logId)
                .execute();
        }
        logger_1.logger.error(`${jobName} failed:`, error);
        throw error;
    }
}

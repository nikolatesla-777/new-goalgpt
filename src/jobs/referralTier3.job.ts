/**
 * Referral Tier 3 Processor Job
 *
 * Schedule: Every 1 minute
 * Purpose: Auto-process Tier 3 rewards when referred user subscribes to VIP
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';
import { grantCredits } from '../services/credits.service';
import { grantXP } from '../services/xp.service';
import { sendPushToUser } from '../services/push.service';

export async function runReferralTier3() {
  const jobName = 'Referral Tier 3 Processor';
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

    // Find Tier 2 referrals where referred user has subscribed
    const eligibleReferrals = await db
      .selectFrom('referrals as r')
      .innerJoin(
        'customer_subscriptions as cs',
        'r.referred_user_id',
        'cs.customer_user_id'
      )
      .select(['r.id', 'r.referrer_user_id', 'r.referred_user_id', 'cs.created_at'])
      .where('r.tier', '=', 2)
      .where('r.status', '=', 'rewarded')
      .where('cs.status', '=', 'active')
      .where('cs.expired_at', '>', new Date())
      .orderBy('cs.created_at', 'desc')
      .execute();

    logger.debug(`Found ${eligibleReferrals.length} Tier 3 referral(s) to process`);

    // Process each referral
    for (const referral of eligibleReferrals) {
      try {
        await db.transaction().execute(async (trx) => {
          // Update referral to Tier 3
          await trx
            .updateTable('referrals')
            .set({
              tier: 3,
              referred_subscribed_at: sql`NOW()`,
            })
            .where('id', '=', referral.id)
            .execute();

          // Grant 200 credits to referrer
          await grantCredits({
            userId: referral.referrer_user_id,
            amount: 200,
            transactionType: 'referral_bonus',
            description: 'Arkadaşın VIP oldu! (Tier 3)',
            referenceId: referral.id,
            referenceType: 'referral',
          });

          // Grant 500 XP to referrer
          await grantXP({
            userId: referral.referrer_user_id,
            amount: 500,
            transactionType: 'referral_signup',
            description: 'Arkadaşın VIP oldu! (Tier 3)',
            referenceId: referral.id,
            referenceType: 'referral',
          });

          // Send push to referrer
          await sendPushToUser(referral.referrer_user_id, {
            title: 'Arkadaşın VIP Oldu! 🎉',
            body: 'Arkadaşın VIP üye oldu! 200 kredi + 500 XP kazandın.',
            data: {
              type: 'referral_tier3',
              referralId: referral.id,
            },
            deepLink: 'goalgpt://referrals',
          });

          logger.info(`Referral Tier 3 processed: ${referral.id}`);
          processedCount++;
        });
      } catch (referralError: any) {
        logger.error(`Error processing referral ${referral.id}:`, referralError);
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

    if (processedCount > 0) {
      logger.info(`${jobName}: Processed ${processedCount} referral(s) in ${duration}ms`);
    }
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

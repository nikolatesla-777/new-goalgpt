/**
 * Referral Tier 2 Processor Job
 *
 * Schedule: Every 1 minute
 * Purpose: Auto-process Tier 2 rewards when referred user logs in for first time
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';
import { grantCredits } from '../services/credits.service';
import { sendPushToUser } from '../services/push.service';

export async function runReferralTier2() {
  const jobName = 'Referral Tier 2 Processor';
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

    // Find Tier 1 referrals where referred user has logged in
    const eligibleReferrals = await db
      .selectFrom('referrals as r')
      .innerJoin('customer_oauth_identities as oi', 'r.referred_user_id', 'oi.customer_user_id')
      .select(['r.id', 'r.referrer_user_id', 'r.referred_user_id', 'oi.last_login_at'])
      .where('r.tier', '=', 1)
      .where('r.status', '=', 'completed')
      .where('oi.last_login_at', 'is not', null)
      .orderBy('oi.last_login_at', 'desc')
      .execute();

    logger.debug(`Found ${eligibleReferrals.length} Tier 2 referral(s) to process`);

    // Process each referral
    for (const referral of eligibleReferrals) {
      try {
        await db.transaction().execute(async (trx) => {
          // Update referral to Tier 2
          await trx
            .updateTable('referrals')
            .set({
              tier: 2,
              status: 'rewarded',
            })
            .where('id', '=', referral.id)
            .execute();

          // Grant 50 credits to referrer
          await grantCredits({
            userId: referral.referrer_user_id,
            amount: 50,
            transactionType: 'referral_bonus',
            description: 'Arkadaşın giriş yaptı! (Tier 2)',
            referenceId: referral.id,
            referenceType: 'referral',
          });

          // Grant 10 credits to referred user
          await grantCredits({
            userId: referral.referred_user_id,
            amount: 10,
            transactionType: 'referral_bonus',
            description: 'Hoş geldin! Giriş bonusu',
            referenceId: referral.id,
            referenceType: 'referral',
          });

          // Send push to referrer
          await sendPushToUser(referral.referrer_user_id, {
            title: 'Arkadaşın Giriş Yaptı! 💰',
            body: 'Arkadaşın ilk girişini yaptı! 50 kredi kazandın.',
            data: {
              type: 'referral_tier2',
              referralId: referral.id,
            },
            deepLink: 'goalgpt://referrals',
          });

          // Send push to referred user
          await sendPushToUser(referral.referred_user_id, {
            title: 'Hoş Geldin! 🎁',
            body: '10 kredi hediyemiz seninle!',
            data: {
              type: 'welcome_bonus',
              referralId: referral.id,
            },
            deepLink: 'goalgpt://credits',
          });

          logger.info(`Referral Tier 2 processed: ${referral.id}`);
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

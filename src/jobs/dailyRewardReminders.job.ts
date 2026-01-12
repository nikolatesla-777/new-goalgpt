/**
 * Daily Reward Reminders Job
 *
 * Schedule: Daily at 20:00 (8 PM)
 * Purpose: Remind users who haven't claimed today's daily reward
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';
import { sendPushToUser } from '../services/push.service';

export async function runDailyRewardReminders() {
  const jobName = 'Daily Reward Reminders';
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

    // Get today's date (midnight UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find users who:
    // 1. Have NOT claimed daily reward today
    // 2. Have claimed in the last 7 days (active users)
    // 3. Have FCM tokens
    const eligibleUsers = await db
      .selectFrom('customer_users as cu')
      .innerJoin('customer_push_tokens as cpt', 'cu.id', 'cpt.customer_user_id')
      .leftJoin('customer_daily_rewards as cdr', (join) =>
        join
          .onRef('cu.id', '=', 'cdr.customer_user_id')
          .on('cdr.reward_date', '=', today)
      )
      .leftJoin('customer_daily_rewards as cdr_recent', (join) =>
        join
          .onRef('cu.id', '=', 'cdr_recent.customer_user_id')
          .on('cdr_recent.reward_date', '>=', sql`NOW() - INTERVAL '7 days'`)
      )
      .select([
        'cu.id',
        'cu.name',
        sql<number>`COUNT(DISTINCT cdr_recent.id)`.as('recent_claims'),
      ])
      .where('cu.deleted_at', 'is', null)
      .where('cpt.is_active', '=', true)
      .where('cdr.id', 'is', null) // Not claimed today
      .groupBy(['cu.id', 'cu.name'])
      .having(sql`COUNT(DISTINCT cdr_recent.id)`, '>', 0) // Has claimed in last 7 days
      .execute();

    logger.info(`Found ${eligibleUsers.length} user(s) to remind about daily rewards`);

    // Send reminders
    for (const user of eligibleUsers) {
      try {
        // Get user's current day number
        const lastClaim = await db
          .selectFrom('customer_daily_rewards')
          .select(['reward_date', 'day_number'])
          .where('customer_user_id', '=', user.id)
          .orderBy('reward_date', 'desc')
          .limit(1)
          .executeTakeFirst();

        // Calculate next day number
        let nextDay = 1;
        if (lastClaim) {
          const lastClaimDate = new Date(lastClaim.reward_date);
          lastClaimDate.setUTCHours(0, 0, 0, 0);

          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          if (lastClaimDate.getTime() === yesterday.getTime()) {
            // Continue streak
            nextDay = lastClaim.day_number + 1;
            if (nextDay > 7) nextDay = 1;
          }
        }

        // Get reward for that day
        const dailyRewards = [
          { day: 1, credits: 10, xp: 10 },
          { day: 2, credits: 15, xp: 15 },
          { day: 3, credits: 20, xp: 20 },
          { day: 4, credits: 25, xp: 25 },
          { day: 5, credits: 30, xp: 30 },
          { day: 6, credits: 40, xp: 40 },
          { day: 7, credits: 100, xp: 50 },
        ];

        const reward = dailyRewards[nextDay - 1];

        // Send push notification
        await sendPushToUser(user.id, {
          title: 'Günlük Ödül 🎁',
          body: `Günlük ödülünü almayı unutma! Bugün ${reward.credits} kredi seni bekliyor.`,
          data: {
            type: 'daily_reward_reminder',
            day: String(nextDay),
            credits: String(reward.credits),
            xp: String(reward.xp),
          },
          deepLink: 'goalgpt://daily-rewards',
        });

        processedCount++;
      } catch (userError: any) {
        logger.error(`Error sending reminder to user ${user.id}:`, userError);
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

    logger.info(`${jobName}: Sent ${processedCount} reminder(s) in ${duration}ms`);
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

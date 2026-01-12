/**
 * Streak Break Warnings Job
 *
 * Schedule: Daily at 22:00 (10 PM)
 * Purpose: Warn users who haven't logged in today (about to lose streak)
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';
import { sendPushToUser } from '../services/push.service';

export async function runStreakBreakWarnings() {
  const jobName = 'Streak Break Warnings';
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

    // Get today's date
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find users who:
    // 1. Have current_streak_days >= 3 (invested users)
    // 2. last_activity_date < today (haven't logged in today)
    // 3. Have FCM tokens
    const eligibleUsers = await db
      .selectFrom('customer_xp as xp')
      .innerJoin('customer_users as cu', 'xp.customer_user_id', 'cu.id')
      .innerJoin('customer_push_tokens as cpt', 'cu.id', 'cpt.customer_user_id')
      .select([
        'cu.id',
        'cu.name',
        'xp.current_streak_days',
        'xp.last_activity_date',
      ])
      .where('cu.deleted_at', 'is', null)
      .where('cpt.is_active', '=', true)
      .where('xp.current_streak_days', '>=', 3) // At least 3-day streak
      .where('xp.last_activity_date', '<', today) // Not logged in today
      .groupBy(['cu.id', 'cu.name', 'xp.current_streak_days', 'xp.last_activity_date'])
      .execute();

    logger.info(`Found ${eligibleUsers.length} user(s) at risk of losing streak`);

    // Send warnings
    for (const user of eligibleUsers) {
      try {
        // Calculate hours remaining until midnight
        const now = new Date();
        const midnight = new Date(today);
        midnight.setDate(midnight.getDate() + 1); // Tomorrow midnight
        const hoursRemaining = Math.floor((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));

        await sendPushToUser(user.id, {
          title: 'Streak Uyarısı 🔥',
          body: `${user.current_streak_days} günlük serini kaybetme! Gece yarısına ${hoursRemaining} saat kaldı.`,
          data: {
            type: 'streak_warning',
            currentStreak: String(user.current_streak_days),
            hoursRemaining: String(hoursRemaining),
          },
          deepLink: 'goalgpt://home',
        });

        processedCount++;
      } catch (userError: any) {
        logger.error(`Error sending streak warning to user ${user.id}:`, userError);
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

    logger.info(`${jobName}: Sent ${processedCount} warning(s) in ${duration}ms`);
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

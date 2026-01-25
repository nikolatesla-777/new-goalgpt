/**
 * Badge Auto-Unlock Job
 *
 * Schedule: Every 5 minutes
 * Purpose: Automatically unlock badges when users meet conditions
 */

import { db } from '../database/kysely';
import { logger } from '../utils/logger';
import { sql } from 'kysely';
import { grantXP, XPTransactionType } from '../services/xp.service';
import { grantCredits } from '../services/credits.service';
import { sendPushToUser } from '../services/push.service';

export async function runBadgeAutoUnlock() {
  const jobName = 'Badge Auto-Unlock';
  const startTime = Date.now();
  let processedCount = 0;
  let unlockedCount = 0;
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

    // Fetch all active badges
    const badges = await db
      .selectFrom('badges')
      .selectAll()
      .where('is_active', '=', true)
      .where('deleted_at', 'is', null)
      .execute();

    logger.info(`Checking ${badges.length} badges for auto-unlock...`);

    // Process each badge
    for (const badge of badges) {
      try {
        const condition = badge.unlock_condition as any;

        // Find users who meet conditions but don't have badge yet
        let eligibleUsers: string[] = [];

        switch (condition.type) {
          case 'referrals':
            // Count referrals per user
            eligibleUsers = await findUsersWithReferralCount(condition.count);
            break;

          case 'predictions':
            // Count correct predictions or check accuracy
            if (condition.correct_count) {
              eligibleUsers = await findUsersWithCorrectPredictions(condition.correct_count);
            } else if (condition.accuracy && condition.min_count) {
              eligibleUsers = await findUsersWithPredictionAccuracy(
                condition.accuracy,
                condition.min_count
              );
            }
            break;

          case 'comments':
            // Count comments or likes
            if (condition.count) {
              eligibleUsers = await findUsersWithCommentCount(condition.count);
            } else if (condition.like_count) {
              eligibleUsers = await findUsersWithCommentLikes(condition.like_count);
            }
            break;

          case 'login_streak':
            // Check login streak days
            eligibleUsers = await findUsersWithStreak(condition.days);
            break;

          case 'xp_level':
            // Check XP level
            eligibleUsers = await findUsersWithXPLevel(condition.level);
            break;

          default:
            logger.warn(`Unknown badge condition type: ${condition.type} for badge ${badge.slug}`);
            continue;
        }

        // Filter out users who already have this badge
        const usersWithoutBadge = await filterUsersWithoutBadge(eligibleUsers, badge.id);

        // Unlock badge for eligible users
        for (const userId of usersWithoutBadge) {
          try {
            await unlockBadgeForUser(userId, badge);
            unlockedCount++;
          } catch (unlockError: any) {
            logger.error(`Error unlocking badge ${badge.slug} for user ${userId}:`, unlockError);
          }
        }

        processedCount++;
      } catch (badgeError: any) {
        logger.error(`Error processing badge ${badge.slug}:`, badgeError);
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

    logger.info(
      `${jobName}: Processed ${processedCount} badges, unlocked ${unlockedCount} new badges in ${duration}ms`
    );
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

/**
 * Helper: Find users with at least N referrals
 */
async function findUsersWithReferralCount(count: number): Promise<string[]> {
  const results = await db
    .selectFrom('referrals')
    .select('referrer_user_id')
    .groupBy('referrer_user_id')
    .having(sql`COUNT(*)`, '>=', count)
    .execute();

  return results.map((r) => r.referrer_user_id);
}

/**
 * Helper: Find users with at least N correct predictions
 */
async function findUsersWithCorrectPredictions(count: number): Promise<string[]> {
  // TODO: Implement when prediction tracking is added
  return [];
}

/**
 * Helper: Find users with prediction accuracy >= X% (min N predictions)
 */
async function findUsersWithPredictionAccuracy(
  accuracy: number,
  minCount: number
): Promise<string[]> {
  // TODO: Implement when prediction tracking is added
  return [];
}

/**
 * Helper: Find users with at least N comments
 */
async function findUsersWithCommentCount(count: number): Promise<string[]> {
  const results = await db
    .selectFrom('match_comments')
    .select('customer_user_id')
    .where('status', '=', 'active')
    .where('deleted_at', 'is', null)
    .groupBy('customer_user_id')
    .having(sql`COUNT(*)`, '>=', count)
    .execute();

  return results.map((r) => r.customer_user_id);
}

/**
 * Helper: Find users whose comments have received at least N likes
 */
async function findUsersWithCommentLikes(likeCount: number): Promise<string[]> {
  const results = await db
    .selectFrom('match_comments as mc')
    .innerJoin('match_comment_likes as mcl', 'mc.id', 'mcl.comment_id')
    .select('mc.customer_user_id')
    .where('mc.status', '=', 'active')
    .where('mc.deleted_at', 'is', null)
    .groupBy('mc.customer_user_id')
    .having(sql`COUNT(mcl.id)`, '>=', likeCount)
    .execute();

  return results.map((r) => r.customer_user_id);
}

/**
 * Helper: Find users with login streak >= N days
 */
async function findUsersWithStreak(days: number): Promise<string[]> {
  const results = await db
    .selectFrom('customer_xp')
    .select('customer_user_id')
    .where('current_streak_days', '>=', days)
    .execute();

  return results.map((r) => r.customer_user_id);
}

/**
 * Helper: Find users with specific XP level
 */
async function findUsersWithXPLevel(level: string): Promise<string[]> {
  const results = await db
    .selectFrom('customer_xp')
    .select('customer_user_id')
    .where('level', '=', level as any)
    .execute();

  return results.map((r) => r.customer_user_id);
}

/**
 * Helper: Filter out users who already have badge
 */
async function filterUsersWithoutBadge(
  userIds: string[],
  badgeId: string
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const usersWithBadge = await db
    .selectFrom('customer_badges')
    .select('customer_user_id')
    .where('badge_id', '=', badgeId)
    .where('customer_user_id', 'in', userIds)
    .execute();

  const usersWithBadgeIds = new Set(usersWithBadge.map((u) => u.customer_user_id));
  return userIds.filter((id) => !usersWithBadgeIds.has(id));
}

/**
 * Unlock badge for user and grant rewards
 */
async function unlockBadgeForUser(userId: string, badge: any) {
  return db.transaction().execute(async (trx) => {
    // Insert badge unlock
    await trx
      .insertInto('customer_badges')
      .values({
        customer_user_id: userId,
        badge_id: badge.id,
        unlocked_at: sql`NOW()`,
      } as any)
      .execute();

    // Update badge total_unlocks
    await trx
      .updateTable('badges')
      .set({
        total_unlocks: sql`total_unlocks + 1`,
      })
      .where('id', '=', badge.id)
      .execute();

    // Grant XP reward if any
    if (badge.reward_xp > 0) {
      await grantXP({
        userId,
        amount: badge.reward_xp,
        transactionType: XPTransactionType.BADGE_UNLOCK,
        description: `${badge.name_tr} rozeti kazandın!`,
        referenceId: badge.id,
        referenceType: 'badge',
      });
    }

    // Grant credit reward if any
    if (badge.reward_credits > 0) {
      await grantCredits({
        userId,
        amount: badge.reward_credits,
        transactionType: 'badge_reward',
        description: `${badge.name_tr} rozeti ödülü`,
        referenceId: badge.id,
        referenceType: 'badge',
      });
    }

    // Send push notification
    await sendPushToUser(userId, {
      title: 'Yeni Rozet! 🎖️',
      body: `${badge.name_tr} rozetini kazandın!`,
      data: {
        type: 'badge_unlock',
        badgeId: badge.id,
        badgeSlug: badge.slug,
      },
      imageUrl: badge.icon_url,
      deepLink: 'goalgpt://badges',
    });

    logger.info(`Badge unlocked: ${badge.slug} for user ${userId}`);
  });
}

"use strict";
/**
 * Badge Auto-Unlock Job
 *
 * Schedule: Every 5 minutes
 * Purpose: Automatically unlock badges when users meet conditions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBadgeAutoUnlock = runBadgeAutoUnlock;
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
const kysely_2 = require("kysely");
const xp_service_1 = require("../services/xp.service");
const credits_service_1 = require("../services/credits.service");
const push_service_1 = require("../services/push.service");
async function runBadgeAutoUnlock() {
    const jobName = 'Badge Auto-Unlock';
    const startTime = Date.now();
    let processedCount = 0;
    let unlockedCount = 0;
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
        // Fetch all active badges
        const badges = await kysely_1.db
            .selectFrom('badges')
            .selectAll()
            .where('is_active', '=', true)
            .where('deleted_at', 'is', null)
            .execute();
        logger_1.logger.info(`Checking ${badges.length} badges for auto-unlock...`);
        // Process each badge
        for (const badge of badges) {
            try {
                const condition = badge.unlock_condition;
                // Find users who meet conditions but don't have badge yet
                let eligibleUsers = [];
                switch (condition.type) {
                    case 'referrals':
                        // Count referrals per user
                        eligibleUsers = await findUsersWithReferralCount(condition.count);
                        break;
                    case 'predictions':
                        // Count correct predictions or check accuracy
                        if (condition.correct_count) {
                            eligibleUsers = await findUsersWithCorrectPredictions(condition.correct_count);
                        }
                        else if (condition.accuracy && condition.min_count) {
                            eligibleUsers = await findUsersWithPredictionAccuracy(condition.accuracy, condition.min_count);
                        }
                        break;
                    case 'comments':
                        // Count comments or likes
                        if (condition.count) {
                            eligibleUsers = await findUsersWithCommentCount(condition.count);
                        }
                        else if (condition.like_count) {
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
                        logger_1.logger.warn(`Unknown badge condition type: ${condition.type} for badge ${badge.slug}`);
                        continue;
                }
                // Filter out users who already have this badge
                const usersWithoutBadge = await filterUsersWithoutBadge(eligibleUsers, badge.id);
                // Unlock badge for eligible users
                for (const userId of usersWithoutBadge) {
                    try {
                        await unlockBadgeForUser(userId, badge);
                        unlockedCount++;
                    }
                    catch (unlockError) {
                        logger_1.logger.error(`Error unlocking badge ${badge.slug} for user ${userId}:`, unlockError);
                    }
                }
                processedCount++;
            }
            catch (badgeError) {
                logger_1.logger.error(`Error processing badge ${badge.slug}:`, badgeError);
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
        logger_1.logger.info(`${jobName}: Processed ${processedCount} badges, unlocked ${unlockedCount} new badges in ${duration}ms`);
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
/**
 * Helper: Find users with at least N referrals
 */
async function findUsersWithReferralCount(count) {
    const results = await kysely_1.db
        .selectFrom('referrals')
        .select('referrer_user_id')
        .groupBy('referrer_user_id')
        .having((0, kysely_2.sql) `COUNT(*)`, '>=', count)
        .execute();
    return results.map((r) => r.referrer_user_id);
}
/**
 * Helper: Find users with at least N correct predictions
 */
async function findUsersWithCorrectPredictions(count) {
    // TODO: Implement when prediction tracking is added
    return [];
}
/**
 * Helper: Find users with prediction accuracy >= X% (min N predictions)
 */
async function findUsersWithPredictionAccuracy(accuracy, minCount) {
    // TODO: Implement when prediction tracking is added
    return [];
}
/**
 * Helper: Find users with at least N comments
 */
async function findUsersWithCommentCount(count) {
    const results = await kysely_1.db
        .selectFrom('match_comments')
        .select('customer_user_id')
        .where('status', '=', 'active')
        .where('deleted_at', 'is', null)
        .groupBy('customer_user_id')
        .having((0, kysely_2.sql) `COUNT(*)`, '>=', count)
        .execute();
    return results.map((r) => r.customer_user_id);
}
/**
 * Helper: Find users whose comments have received at least N likes
 */
async function findUsersWithCommentLikes(likeCount) {
    const results = await kysely_1.db
        .selectFrom('match_comments as mc')
        .innerJoin('match_comment_likes as mcl', 'mc.id', 'mcl.comment_id')
        .select('mc.customer_user_id')
        .where('mc.status', '=', 'active')
        .where('mc.deleted_at', 'is', null)
        .groupBy('mc.customer_user_id')
        .having((0, kysely_2.sql) `COUNT(mcl.id)`, '>=', likeCount)
        .execute();
    return results.map((r) => r.customer_user_id);
}
/**
 * Helper: Find users with login streak >= N days
 */
async function findUsersWithStreak(days) {
    const results = await kysely_1.db
        .selectFrom('customer_xp')
        .select('customer_user_id')
        .where('current_streak_days', '>=', days)
        .execute();
    return results.map((r) => r.customer_user_id);
}
/**
 * Helper: Find users with specific XP level
 */
async function findUsersWithXPLevel(level) {
    const results = await kysely_1.db
        .selectFrom('customer_xp')
        .select('customer_user_id')
        .where('level', '=', level)
        .execute();
    return results.map((r) => r.customer_user_id);
}
/**
 * Helper: Filter out users who already have badge
 */
async function filterUsersWithoutBadge(userIds, badgeId) {
    if (userIds.length === 0)
        return [];
    const usersWithBadge = await kysely_1.db
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
async function unlockBadgeForUser(userId, badge) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // Insert badge unlock
        await trx
            .insertInto('customer_badges')
            .values({
            customer_user_id: userId,
            badge_id: badge.id,
            unlocked_at: (0, kysely_2.sql) `NOW()`,
        })
            .execute();
        // Update badge total_unlocks
        await trx
            .updateTable('badges')
            .set({
            total_unlocks: (0, kysely_2.sql) `total_unlocks + 1`,
        })
            .where('id', '=', badge.id)
            .execute();
        // Grant XP reward if any
        if (badge.reward_xp > 0) {
            await (0, xp_service_1.grantXP)({
                userId,
                amount: badge.reward_xp,
                transactionType: 'badge_unlock',
                description: `${badge.name_tr} rozeti kazandın!`,
                referenceId: badge.id,
                referenceType: 'badge',
            });
        }
        // Grant credit reward if any
        if (badge.reward_credits > 0) {
            await (0, credits_service_1.grantCredits)({
                userId,
                amount: badge.reward_credits,
                transactionType: 'badge_reward',
                description: `${badge.name_tr} rozeti ödülü`,
                referenceId: badge.id,
                referenceType: 'badge',
            });
        }
        // Send push notification
        await (0, push_service_1.sendPushToUser)(userId, {
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
        logger_1.logger.info(`Badge unlocked: ${badge.slug} for user ${userId}`);
    });
}

"use strict";
/**
 * Daily Reward Reminders Job
 *
 * Schedule: Daily at 20:00 (8 PM)
 * Purpose: Remind users who haven't claimed today's daily reward
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyRewardReminders = runDailyRewardReminders;
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
const kysely_2 = require("kysely");
const push_service_1 = require("../services/push.service");
async function runDailyRewardReminders() {
    const jobName = 'Daily Reward Reminders';
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
        // Get today's date (midnight UTC)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        // Find users who:
        // 1. Have NOT claimed daily reward today
        // 2. Have claimed in the last 7 days (active users)
        // 3. Have FCM tokens
        const eligibleUsers = await kysely_1.db
            .selectFrom('customer_users as cu')
            .innerJoin('customer_push_tokens as cpt', 'cu.id', 'cpt.customer_user_id')
            .leftJoin('customer_daily_rewards as cdr', (join) => join
            .onRef('cu.id', '=', 'cdr.customer_user_id')
            .on('cdr.reward_date', '=', today))
            .leftJoin('customer_daily_rewards as cdr_recent', (join) => join
            .onRef('cu.id', '=', 'cdr_recent.customer_user_id')
            .on('cdr_recent.reward_date', '>=', (0, kysely_2.sql) `NOW() - INTERVAL '7 days'`))
            .select([
            'cu.id',
            'cu.name',
            (0, kysely_2.sql) `COUNT(DISTINCT cdr_recent.id)`.as('recent_claims'),
        ])
            .where('cu.deleted_at', 'is', null)
            .where('cpt.is_active', '=', true)
            .where('cdr.id', 'is', null) // Not claimed today
            .groupBy(['cu.id', 'cu.name'])
            .having((0, kysely_2.sql) `COUNT(DISTINCT cdr_recent.id)`, '>', 0) // Has claimed in last 7 days
            .execute();
        logger_1.logger.info(`Found ${eligibleUsers.length} user(s) to remind about daily rewards`);
        // Send reminders
        for (const user of eligibleUsers) {
            try {
                // Get user's current day number
                const lastClaim = await kysely_1.db
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
                        if (nextDay > 7)
                            nextDay = 1;
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
                await (0, push_service_1.sendPushToUser)(user.id, {
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
            }
            catch (userError) {
                logger_1.logger.error(`Error sending reminder to user ${user.id}:`, userError);
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
        logger_1.logger.info(`${jobName}: Sent ${processedCount} reminder(s) in ${duration}ms`);
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

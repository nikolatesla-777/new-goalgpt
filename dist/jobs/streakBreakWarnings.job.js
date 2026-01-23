"use strict";
/**
 * Streak Break Warnings Job
 *
 * Schedule: Daily at 22:00 (10 PM)
 * Purpose: Warn users who haven't logged in today (about to lose streak)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStreakBreakWarnings = runStreakBreakWarnings;
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
const kysely_2 = require("kysely");
const push_service_1 = require("../services/push.service");
async function runStreakBreakWarnings() {
    const jobName = 'Streak Break Warnings';
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
        // Get today's date
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        // Find users who:
        // 1. Have current_streak_days >= 3 (invested users)
        // 2. last_activity_date < today (haven't logged in today)
        // 3. Have FCM tokens
        const eligibleUsers = await kysely_1.db
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
        logger_1.logger.info(`Found ${eligibleUsers.length} user(s) at risk of losing streak`);
        // Send warnings
        for (const user of eligibleUsers) {
            try {
                // Calculate hours remaining until midnight
                const now = new Date();
                const midnight = new Date(today);
                midnight.setDate(midnight.getDate() + 1); // Tomorrow midnight
                const hoursRemaining = Math.floor((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
                await (0, push_service_1.sendPushToUser)(user.id, {
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
            }
            catch (userError) {
                logger_1.logger.error(`Error sending streak warning to user ${user.id}:`, userError);
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
        logger_1.logger.info(`${jobName}: Sent ${processedCount} warning(s) in ${duration}ms`);
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

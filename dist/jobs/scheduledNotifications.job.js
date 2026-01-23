"use strict";
/**
 * Scheduled Notifications Job
 *
 * Schedule: Every 1 minute
 * Purpose: Send scheduled push notifications from queue
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runScheduledNotifications = runScheduledNotifications;
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
const kysely_2 = require("kysely");
const push_service_1 = require("../services/push.service");
async function runScheduledNotifications() {
    const jobName = 'Scheduled Notifications';
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
        // Find notifications that are due to be sent
        const now = new Date();
        const pendingNotifications = await kysely_1.db
            .selectFrom('scheduled_notifications')
            .selectAll()
            .where('status', '=', 'pending')
            .where('scheduled_at', '<=', now)
            .orderBy('scheduled_at', 'asc')
            .limit(10) // Process max 10 notifications per run
            .execute();
        if (pendingNotifications.length === 0) {
            logger_1.logger.debug('No pending notifications to send');
        }
        else {
            logger_1.logger.info(`Found ${pendingNotifications.length} notification(s) to send`);
        }
        // Process each notification
        for (const notification of pendingNotifications) {
            try {
                // Update status to 'sending'
                await kysely_1.db
                    .updateTable('scheduled_notifications')
                    .set({ status: 'sending' })
                    .where('id', '=', notification.id)
                    .execute();
                // Determine language (default to Turkish)
                const title = notification.title_tr;
                const body = notification.body_tr;
                // Send based on target audience
                let result;
                if (notification.target_audience === 'all' ||
                    notification.target_audience === 'vip' ||
                    notification.target_audience === 'free') {
                    result = await (0, push_service_1.sendPushToAudience)(notification.target_audience, {
                        title,
                        body,
                        imageUrl: notification.image_url || undefined,
                        deepLink: notification.deep_link_url || undefined,
                        data: {
                            notificationId: notification.id,
                        },
                    }, notification.segment_filter);
                }
                else if (notification.target_audience === 'segment') {
                    // Handle custom segment
                    // TODO: Implement segment filtering logic
                    result = { totalSent: 0, totalFailed: 0, totalDelivered: 0 };
                }
                else {
                    throw new Error(`Unknown target audience: ${notification.target_audience}`);
                }
                // Update notification with results
                await kysely_1.db
                    .updateTable('scheduled_notifications')
                    .set({
                    status: 'sent',
                    sent_at: (0, kysely_2.sql) `NOW()`,
                    recipient_count: result.totalSent + result.totalFailed,
                    success_count: result.totalDelivered,
                    failure_count: result.totalFailed,
                })
                    .where('id', '=', notification.id)
                    .execute();
                logger_1.logger.info(`Notification sent: ${notification.id} (${result.totalDelivered}/${result.totalSent + result.totalFailed} delivered)`);
                processedCount++;
            }
            catch (notifError) {
                // Mark notification as failed
                await kysely_1.db
                    .updateTable('scheduled_notifications')
                    .set({
                    status: 'failed',
                    sent_at: (0, kysely_2.sql) `NOW()`,
                })
                    .where('id', '=', notification.id)
                    .execute();
                logger_1.logger.error(`Error sending notification ${notification.id}:`, notifError);
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
        if (processedCount > 0) {
            logger_1.logger.info(`${jobName}: Processed ${processedCount} notification(s) in ${duration}ms`);
        }
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

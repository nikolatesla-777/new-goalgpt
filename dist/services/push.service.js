"use strict";
/**
 * Push Notification Service - FCM Integration
 *
 * Unified service for sending push notifications via Firebase Cloud Messaging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToUser = sendPushToUser;
exports.sendPushToMultipleUsers = sendPushToMultipleUsers;
exports.sendPushToAudience = sendPushToAudience;
exports.getUserTokenCount = getUserTokenCount;
exports.sendTestPush = sendTestPush;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const kysely_1 = require("../database/kysely");
const logger_1 = require("../utils/logger");
/**
 * Send push notification to a single user
 */
async function sendPushToUser(userId, notification) {
    try {
        // Get user's active FCM tokens
        const tokens = await kysely_1.db
            .selectFrom('customer_push_tokens')
            .select('fcm_token')
            .where('customer_user_id', '=', userId)
            .where('is_active', '=', true)
            .execute();
        if (tokens.length === 0) {
            logger_1.logger.debug(`No FCM tokens for user ${userId}`);
            return { success: false, tokensUsed: 0, delivered: 0 };
        }
        const tokenStrings = tokens.map((t) => t.fcm_token);
        // Build FCM message
        const message = {
            notification: {
                title: notification.title,
                body: notification.body,
                imageUrl: notification.imageUrl,
            },
            data: {
                ...(notification.data || {}),
                deepLink: notification.deepLink || '',
            },
            tokens: tokenStrings,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };
        // Send notification
        const response = await firebase_admin_1.default.messaging().sendEachForMulticast(message);
        // Handle failures (mark invalid tokens as inactive)
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    // Mark token as invalid if it's a registration error
                    if (error?.code === 'messaging/invalid-registration-token' ||
                        error?.code === 'messaging/registration-token-not-registered') {
                        failedTokens.push(tokenStrings[idx]);
                    }
                }
            });
            // Mark failed tokens as inactive
            if (failedTokens.length > 0) {
                await kysely_1.db
                    .updateTable('customer_push_tokens')
                    .set({ is_active: false })
                    .where('fcm_token', 'in', failedTokens)
                    .execute();
                logger_1.logger.info(`Marked ${failedTokens.length} invalid tokens as inactive`);
            }
        }
        logger_1.logger.debug(`Push sent to user ${userId}: ${response.successCount}/${tokenStrings.length} delivered`);
        return {
            success: response.successCount > 0,
            tokensUsed: tokenStrings.length,
            delivered: response.successCount,
        };
    }
    catch (error) {
        logger_1.logger.error('FCM send error:', error);
        return { success: false, tokensUsed: 0, delivered: 0 };
    }
}
/**
 * Send push notification to multiple users
 */
async function sendPushToMultipleUsers(userIds, notification) {
    let totalSent = 0;
    let totalFailed = 0;
    let totalDelivered = 0;
    // Process in batches of 100 to avoid overwhelming FCM
    const BATCH_SIZE = 100;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map((userId) => sendPushToUser(userId, notification)));
        totalSent += results.filter((r) => r.success).length;
        totalFailed += results.filter((r) => !r.success).length;
        totalDelivered += results.reduce((sum, r) => sum + r.delivered, 0);
    }
    logger_1.logger.info(`Batch push completed: ${totalSent} sent, ${totalFailed} failed, ${totalDelivered} delivered`);
    return { totalSent, totalFailed, totalDelivered };
}
/**
 * Send push notification to all users matching criteria
 */
async function sendPushToAudience(targetAudience, notification, segmentFilter) {
    try {
        // Build query based on target audience
        let query = kysely_1.db
            .selectFrom('customer_users')
            .select('id')
            .where('deleted_at', 'is', null);
        if (targetAudience === 'vip') {
            // Only users with active subscriptions
            query = query
                .innerJoin('customer_subscriptions', 'customer_users.id', 'customer_subscriptions.customer_user_id')
                .where('customer_subscriptions.status', '=', 'active')
                .where('customer_subscriptions.expired_at', '>', new Date());
        }
        else if (targetAudience === 'free') {
            // Users without active subscriptions
            query = query
                .leftJoin('customer_subscriptions', (join) => join
                .onRef('customer_users.id', '=', 'customer_subscriptions.customer_user_id')
                .on('customer_subscriptions.status', '=', 'active')
                .on('customer_subscriptions.expired_at', '>', new Date()))
                .where('customer_subscriptions.id', 'is', null);
        }
        // Apply custom segment filter if provided
        // TODO: Implement JSONB filter logic for advanced segmentation
        // Fetch user IDs
        const users = await query.execute();
        const userIds = users.map((u) => u.id);
        logger_1.logger.info(`Sending push to ${userIds.length} users (audience: ${targetAudience})`);
        // Send to all users
        return await sendPushToMultipleUsers(userIds, notification);
    }
    catch (error) {
        logger_1.logger.error('Error sending push to audience:', error);
        return { totalSent: 0, totalFailed: 0, totalDelivered: 0 };
    }
}
/**
 * Get user's FCM token count
 */
async function getUserTokenCount(userId) {
    const result = await kysely_1.db
        .selectFrom('customer_push_tokens')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('customer_user_id', '=', userId)
        .where('is_active', '=', true)
        .executeTakeFirst();
    return Number(result?.count || 0);
}
/**
 * Test push notification (for debugging)
 */
async function sendTestPush(userId) {
    const notification = {
        title: 'Test Notification',
        body: 'This is a test push notification from GoalGPT 🎯',
        data: {
            type: 'test',
            timestamp: new Date().toISOString(),
        },
        deepLink: 'goalgpt://home',
    };
    const result = await sendPushToUser(userId, notification);
    return { success: result.success };
}

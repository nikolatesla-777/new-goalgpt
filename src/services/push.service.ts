/**
 * Push Notification Service - FCM Integration
 *
 * Unified service for sending push notifications via Firebase Cloud Messaging
 */

import admin from 'firebase-admin';
import { db } from '../database/kysely';
import { logger } from '../utils/logger';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  deepLink?: string;
}

/**
 * Send push notification to a single user
 */
export async function sendPushToUser(
  userId: string,
  notification: PushNotification
): Promise<{ success: boolean; tokensUsed: number; delivered: number }> {
  try {
    // Get user's active FCM tokens
    const tokens: any[] = await db
      .selectFrom('customer_push_tokens')
      .select(['fcm_token'] as any)
      .where('customer_user_id', '=', userId)
      .where('is_active', '=', true)
      .execute();

    if (tokens.length === 0) {
      logger.debug(`No FCM tokens for user ${userId}`);
      return { success: false, tokensUsed: 0, delivered: 0 };
    }

    const tokenStrings = tokens.map((t) => t.fcm_token);

    // Build FCM message
    const message: admin.messaging.MulticastMessage = {
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
    const response = await admin.messaging().sendEachForMulticast(message);

    // Handle failures (mark invalid tokens as inactive)
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          // Mark token as invalid if it's a registration error
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokenStrings[idx]);
          }
        }
      });

      // Mark failed tokens as inactive
      if (failedTokens.length > 0) {
        await db
          .updateTable('customer_push_tokens')
          .set({ is_active: false })
          .where('fcm_token' as any, 'in', failedTokens)
          .execute();

        logger.info(`Marked ${failedTokens.length} invalid tokens as inactive`);
      }
    }

    logger.debug(
      `Push sent to user ${userId}: ${response.successCount}/${tokenStrings.length} delivered`
    );

    return {
      success: response.successCount > 0,
      tokensUsed: tokenStrings.length,
      delivered: response.successCount,
    };
  } catch (error: any) {
    logger.error('FCM send error:', error);
    return { success: false, tokensUsed: 0, delivered: 0 };
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToMultipleUsers(
  userIds: string[],
  notification: PushNotification
): Promise<{ totalSent: number; totalFailed: number; totalDelivered: number }> {
  let totalSent = 0;
  let totalFailed = 0;
  let totalDelivered = 0;

  // Process in batches of 100 to avoid overwhelming FCM
  const BATCH_SIZE = 100;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((userId) => sendPushToUser(userId, notification))
    );

    totalSent += results.filter((r) => r.success).length;
    totalFailed += results.filter((r) => !r.success).length;
    totalDelivered += results.reduce((sum, r) => sum + r.delivered, 0);
  }

  logger.info(
    `Batch push completed: ${totalSent} sent, ${totalFailed} failed, ${totalDelivered} delivered`
  );

  return { totalSent, totalFailed, totalDelivered };
}

/**
 * Send push notification to all users matching criteria
 */
export async function sendPushToAudience(
  targetAudience: 'all' | 'vip' | 'free',
  notification: PushNotification,
  segmentFilter?: any
): Promise<{ totalSent: number; totalFailed: number; totalDelivered: number }> {
  try {
    // Build query based on target audience
    let query = db
      .selectFrom('customer_users')
      .select(['id'])
      .$narrowType<{ id: string }>()
      .where('deleted_at', 'is', null);

    if (targetAudience === 'vip') {
      // Only users with active subscriptions
      query = query
        .innerJoin('customer_subscriptions', 'customer_users.id', 'customer_subscriptions.customer_user_id')
        .where('customer_subscriptions.status', '=', 'active')
        .where('customer_subscriptions.expired_at', '>', new Date()) as any;
    } else if (targetAudience === 'free') {
      // Users without active subscriptions
      query = query
        .leftJoin('customer_subscriptions', (join: any) =>
          join
            .onRef('customer_users.id', '=', 'customer_subscriptions.customer_user_id')
            .on('customer_subscriptions.status', '=', 'active')
            .on('customer_subscriptions.expired_at', '>', new Date())
        )
        .where('customer_subscriptions.id', 'is', null) as any;
    }

    // Apply custom segment filter if provided
    // TODO: Implement JSONB filter logic for advanced segmentation

    // Fetch user IDs
    const users = await query.execute();
    const userIds = users.map((u) => u.id);

    logger.info(`Sending push to ${userIds.length} users (audience: ${targetAudience})`);

    // Send to all users
    return await sendPushToMultipleUsers(userIds, notification);
  } catch (error: any) {
    logger.error('Error sending push to audience:', error);
    return { totalSent: 0, totalFailed: 0, totalDelivered: 0 };
  }
}

/**
 * Get user's FCM token count
 */
export async function getUserTokenCount(userId: string): Promise<number> {
  const result = await db
    .selectFrom('customer_push_tokens')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('customer_user_id', '=', userId)
    .where('is_active', '=', true)
    .executeTakeFirst();

  return Number(result?.count || 0);
}

/**
 * Test push notification (for debugging)
 */
export async function sendTestPush(userId: string): Promise<{ success: boolean }> {
  const notification: PushNotification = {
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

/**
 * User Repository
 *
 * All database access for user-related entities including push tokens and profiles.
 * This is the ONLY place where DB access is allowed for user operations.
 *
 * PR-4: Repository Layer Lockdown
 */

import { db } from '../database/kysely';
import { sql } from 'kysely';
import { logger } from '../utils/logger';

// ============================================================
// TYPES
// ============================================================

/**
 * Complete user profile with XP, credits, and VIP subscription data
 */
export interface UserProfile {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    username: string | null;
    referral_code: string | null;
    created_at: Date;
    xp_points: number | null;
    level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'vip_elite' | null;
    level_progress: number | null;
    current_streak_days: number | null;
    longest_streak_days: number | null;
    total_xp_earned: number | null;
    credit_balance: number | null;
    credits_lifetime_earned: number | null;
    credits_lifetime_spent: number | null;
    is_vip: boolean;
    vip_expires_at: Date | null;
}

// ============================================================
// USER PROFILE OPERATIONS
// ============================================================

/**
 * Get complete user profile with XP, credits, and VIP subscription
 *
 * @param userId - The user's ID
 * @returns User profile with all gamification data, or null if user not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const userProfile = await db
            .selectFrom('customer_users as cu')
            .leftJoin('customer_xp as xp', 'xp.customer_user_id', 'cu.id')
            .leftJoin('customer_credits as credits', 'credits.customer_user_id', 'cu.id')
            .leftJoin('customer_subscriptions as sub', (join) =>
                join
                    .onRef('sub.customer_user_id', '=', 'cu.id')
                    .on('sub.status', '=', 'active')
                    .on('sub.expired_at', '>', sql`NOW()`)
            )
            .select([
                'cu.id',
                'cu.email',
                'cu.full_name as name',
                'cu.phone',
                'cu.username',
                'cu.referral_code',
                'cu.created_at',
                'xp.xp_points',
                'xp.level',
                'xp.level_progress',
                'xp.current_streak_days',
                'xp.longest_streak_days',
                'xp.total_earned as total_xp_earned',
                'credits.balance as credit_balance',
                'credits.lifetime_earned as credits_lifetime_earned',
                'credits.lifetime_spent as credits_lifetime_spent',
                'sub.expired_at as vip_expires_at',
                sql<boolean>`CASE WHEN sub.id IS NOT NULL THEN true ELSE false END`.as('is_vip'),
            ])
            .where('cu.id', '=', userId)
            .executeTakeFirst();

        return userProfile ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user profile:', error);
        throw error;
    }
}

// ============================================================
// PUSH TOKEN OPERATIONS
// ============================================================

/**
 * Deactivate push tokens for a user
 * Used during logout to invalidate FCM tokens
 *
 * @param userId - The user's ID
 * @param deviceId - Optional specific device ID to deactivate (if not provided, deactivates all)
 */
export async function deactivatePushTokens(
    userId: string,
    deviceId?: string
): Promise<void> {
    try {
        const query = db
            .updateTable('customer_push_tokens')
            .set({ is_active: false, updated_at: sql`NOW()` })
            .where('customer_user_id', '=', userId);

        if (deviceId) {
            // Only invalidate specific device
            await query.where('device_id', '=', deviceId).execute();
        } else {
            // Invalidate all devices for this user
            await query.execute();
        }
    } catch (error) {
        logger.error('[UserRepository] Failed to deactivate push tokens:', error);
        throw error;
    }
}

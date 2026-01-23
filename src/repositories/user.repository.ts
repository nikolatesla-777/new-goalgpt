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

/**
 * Basic user information (for lookups and auth)
 */
export interface BasicUserInfo {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    username: string | null;
    referral_code: string | null;
    created_at: Date;
}

/**
 * OAuth user creation data
 */
export interface OAuthUserData {
    provider: 'google' | 'apple' | 'phone';
    providerId: string; // Google ID, Apple ID, or phone number
    email?: string | null;
    name?: string | null;
    picture?: string | null;
}

/**
 * Device information for push tokens
 */
export interface DeviceInfo {
    fcmToken: string;
    platform: 'ios' | 'android';
    deviceId: string;
    appVersion?: string | null;
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

/**
 * Upsert FCM push token for a user
 * Creates new token or updates existing one based on device_id
 *
 * @param userId - The user's ID
 * @param deviceInfo - Device and FCM token information
 */
export async function upsertPushToken(
    userId: string,
    deviceInfo: DeviceInfo
): Promise<void> {
    try {
        await db
            .insertInto('customer_push_tokens')
            .values({
                customer_user_id: userId,
                token: deviceInfo.fcmToken,
                platform: deviceInfo.platform,
                device_id: deviceInfo.deviceId,
                app_version: deviceInfo.appVersion || null,
                is_active: true,
                created_at: sql`NOW()`,
                updated_at: sql`NOW()`,
            })
            .onConflict((oc) =>
                oc.columns(['customer_user_id', 'device_id']).doUpdateSet({
                    token: deviceInfo.fcmToken,
                    platform: deviceInfo.platform,
                    app_version: deviceInfo.appVersion || null,
                    is_active: true,
                    updated_at: sql`NOW()`,
                })
            )
            .execute();
    } catch (error) {
        logger.error('[UserRepository] Failed to upsert push token:', error);
        throw error;
    }
}

// ============================================================
// USER LOOKUP OPERATIONS
// ============================================================

/**
 * Get user by OAuth provider credentials
 * Used to check if user exists with Google/Apple/Phone OAuth
 *
 * @param provider - OAuth provider (google, apple, phone)
 * @param providerId - Provider-specific user ID
 * @returns User info or null if not found
 */
export async function getUserByOAuthProvider(
    provider: 'google' | 'apple' | 'phone',
    providerId: string
): Promise<BasicUserInfo | null> {
    try {
        const user = await db
            .selectFrom('customer_oauth_identities as coi')
            .innerJoin('customer_users as cu', 'cu.id', 'coi.customer_user_id')
            .select([
                'cu.id',
                'cu.email',
                'cu.full_name as name',
                'cu.phone',
                'cu.username',
                'cu.referral_code',
                'cu.created_at',
            ])
            .where('coi.provider', '=', provider)
            .where('coi.provider_user_id', '=', providerId)
            .where('coi.deleted_at', 'is', null)
            .where('cu.deleted_at', 'is', null)
            .executeTakeFirst();

        return user ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user by OAuth provider:', error);
        throw error;
    }
}

/**
 * Get user by email address
 * Used for account linking when OAuth provides email
 *
 * @param email - User's email address
 * @returns User info or null if not found
 */
export async function getUserByEmail(email: string): Promise<BasicUserInfo | null> {
    try {
        const user = await db
            .selectFrom('customer_users')
            .select(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'created_at'])
            .where('email', '=', email)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        return user ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user by email:', error);
        throw error;
    }
}

/**
 * Get user by phone number
 * Used for phone-based authentication
 *
 * @param phone - User's phone number (E.164 format)
 * @returns User info or null if not found
 */
export async function getUserByPhone(phone: string): Promise<BasicUserInfo | null> {
    try {
        const user = await db
            .selectFrom('customer_users')
            .select(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'created_at'])
            .where('phone', '=', phone)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        return user ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user by phone:', error);
        throw error;
    }
}

/**
 * Get user by ID
 * Used for token refresh and user lookups
 *
 * @param userId - User's unique ID
 * @returns User info or null if not found
 */
export async function getUserById(userId: string): Promise<BasicUserInfo | null> {
    try {
        const user = await db
            .selectFrom('customer_users')
            .select(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'created_at'])
            .where('id', '=', userId)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        return user ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user by ID:', error);
        throw error;
    }
}

/**
 * Get user by email with password hash
 * Used for email/password authentication (includes password_hash for verification)
 *
 * @param email - User's email address (will be normalized to lowercase)
 * @returns User with password hash or null if not found
 */
export async function getUserByEmailWithPassword(email: string): Promise<(BasicUserInfo & { password_hash: string | null }) | null> {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await db
            .selectFrom('customer_users')
            .select([
                'id',
                'email',
                'full_name as name',
                'phone',
                'username',
                'referral_code',
                'created_at',
                'password_hash',
            ])
            .where('email', '=', normalizedEmail)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        return user ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user by email with password:', error);
        throw error;
    }
}

/**
 * Get user by phone with password hash
 * Used for legacy phone/password authentication (includes password_hash for verification)
 *
 * @param phone - User's phone number (normalized: no spaces/dashes)
 * @returns User with password hash or null if not found
 */
export async function getUserByPhoneWithPassword(phone: string): Promise<(BasicUserInfo & { password_hash: string | null; profile_image_url: string | null }) | null> {
    try {
        const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
        const row = await db
            .selectFrom('customer_users')
            .selectAll()
            .where('phone', '=', normalizedPhone)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        if (!row) return null;

        const user: BasicUserInfo & { password_hash: string | null; profile_image_url: string | null } = {
            id: row.id,
            email: row.email,
            name: row.full_name,
            phone: row.phone,
            username: row.username,
            referral_code: row.referral_code,
            created_at: row.created_at,
            password_hash: row.password_hash,
            profile_image_url: row.profile_image_url,
        };

        return user ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get user by phone with password:', error);
        throw error;
    }
}

// ============================================================
// USER CREATION OPERATIONS
// ============================================================

/**
 * Create new user with email/password authentication
 * Atomically creates user with password, XP, and credits (no OAuth identity)
 *
 * @param email - User's email (will be normalized)
 * @param passwordHash - Bcrypt hashed password
 * @param name - User's full name (optional)
 * @returns Created user's basic info
 */
export async function createEmailPasswordUser(
    email: string,
    passwordHash: string,
    name?: string | null
): Promise<BasicUserInfo> {
    try {
        let createdUser: BasicUserInfo | undefined;
        const normalizedEmail = email.toLowerCase().trim();

        await db.transaction().execute(async (trx) => {
            // Generate unique referral code
            const referralCode = `GG${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            // Create user
            const newUser = await trx
                .insertInto('customer_users')
                .values({
                    email: normalizedEmail,
                    password_hash: passwordHash,
                    full_name: name || null,
                    phone: null,
                    username: null,
                    referral_code: referralCode,
                    is_active: true,
                    is_online: false,
                    two_fa_enabled: false,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .returning(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'created_at'])
                .executeTakeFirstOrThrow();

            createdUser = newUser;

            // Initialize XP
            await trx
                .insertInto('customer_xp')
                .values({
                    customer_user_id: newUser.id,
                    xp_points: 0,
                    level: 'bronze',
                    level_progress: 0,
                    total_earned: 0,
                    current_streak_days: 0,
                    longest_streak_days: 0,
                    achievements_count: 0,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .execute();

            // Initialize Credits with 100 welcome bonus
            await trx
                .insertInto('customer_credits')
                .values({
                    customer_user_id: newUser.id,
                    balance: 100,
                    lifetime_earned: 100,
                    lifetime_spent: 0,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .execute();

            logger.info('[UserRepository] New user created via email/password:', {
                userId: newUser.id,
                email: normalizedEmail,
            });
        });

        return createdUser!;
    } catch (error) {
        logger.error('[UserRepository] Failed to create email/password user:', error);
        throw error;
    }
}

/**
 * Create new user with OAuth authentication
 * Atomically creates user, OAuth identity, XP, and credits in a transaction
 *
 * @param oauthData - OAuth provider data (Google/Apple/Phone)
 * @returns Created user's basic info
 */
export async function createOAuthUser(oauthData: OAuthUserData): Promise<BasicUserInfo> {
    try {
        let createdUser: BasicUserInfo | undefined;

        await db.transaction().execute(async (trx) => {
            // Generate unique referral code
            const referralCode = `GOAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            // Determine user fields based on provider
            const userValues: any = {
                referral_code: referralCode,
                created_at: sql`NOW()`,
                updated_at: sql`NOW()`,
            };

            if (oauthData.provider === 'google') {
                userValues.email = oauthData.email;
                userValues.full_name = oauthData.name || oauthData.email?.split('@')[0] || null;
                userValues.google_id = oauthData.providerId;
                userValues.phone = null;
                userValues.username = null;
            } else if (oauthData.provider === 'apple') {
                userValues.email = oauthData.email;
                userValues.full_name = oauthData.name || oauthData.email?.split('@')[0] || null;
                userValues.apple_id = oauthData.providerId;
                userValues.phone = null;
                userValues.username = null;
            } else if (oauthData.provider === 'phone') {
                userValues.phone = oauthData.providerId;
                userValues.email = null;
                userValues.full_name = null;
                userValues.username = null;
            }

            // Create user
            const newUser = await trx
                .insertInto('customer_users')
                .values(userValues)
                .returning(['id', 'email', 'full_name as name', 'phone', 'username', 'referral_code', 'created_at'])
                .executeTakeFirstOrThrow();

            createdUser = newUser;

            // Create OAuth identity
            await trx
                .insertInto('customer_oauth_identities')
                .values({
                    customer_user_id: newUser.id,
                    provider: oauthData.provider,
                    provider_user_id: oauthData.providerId,
                    email: oauthData.email || null,
                    display_name: oauthData.name || null,
                    profile_photo_url: oauthData.picture || null,
                    is_primary: true,
                    last_login_at: sql`NOW()`,
                    linked_at: sql`NOW()`,
                    created_at: sql`NOW()`,
                    updated_at: sql`NOW()`,
                })
                .execute();

            // Initialize XP
            await trx
                .insertInto('customer_xp')
                .values({
                    customer_user_id: newUser.id,
                    xp_points: 0,
                    level: 'bronze',
                    level_progress: 0,
                    total_earned: 0,
                    current_streak_days: 0,
                    longest_streak_days: 0,
                    achievements_count: 0,
                    created_at: sql`NOW()`,
                    updated_at: sql`NOW()`,
                })
                .execute();

            // Initialize Credits
            await trx
                .insertInto('customer_credits')
                .values({
                    customer_user_id: newUser.id,
                    balance: 0,
                    lifetime_earned: 0,
                    lifetime_spent: 0,
                    created_at: sql`NOW()`,
                    updated_at: sql`NOW()`,
                })
                .execute();

            logger.info(`[UserRepository] New user created via ${oauthData.provider} OAuth:`, {
                userId: newUser.id,
                provider: oauthData.provider,
            });
        });

        return createdUser!;
    } catch (error) {
        logger.error('[UserRepository] Failed to create OAuth user:', error);
        throw error;
    }
}

// ============================================================
// OAUTH LINKING OPERATIONS
// ============================================================

/**
 * Check if OAuth identity exists
 * Used to prevent duplicate OAuth links
 *
 * @param provider - OAuth provider (google, apple)
 * @param providerId - Provider-specific user ID
 * @returns OAuth identity with customer_user_id or null
 */
export async function getOAuthIdentity(
    provider: 'google' | 'apple',
    providerId: string
): Promise<{ customer_user_id: string } | null> {
    try {
        const identity = await db
            .selectFrom('customer_oauth_identities')
            .select(['customer_user_id'])
            .where('provider', '=', provider)
            .where('provider_user_id', '=', providerId)
            .executeTakeFirst();

        return identity ?? null;
    } catch (error) {
        logger.error('[UserRepository] Failed to get OAuth identity:', error);
        throw error;
    }
}

/**
 * Link OAuth provider to existing user
 * Updates or creates OAuth identity for account linking
 *
 * @param userId - Existing user's ID
 * @param oauthData - OAuth provider data to link
 */
export async function linkOAuthProvider(
    userId: string,
    oauthData: OAuthUserData
): Promise<void> {
    try {
        await db
            .insertInto('customer_oauth_identities')
            .values({
                customer_user_id: userId,
                provider: oauthData.provider,
                provider_user_id: oauthData.providerId,
                email: oauthData.email || null,
                display_name: oauthData.name || null,
                profile_photo_url: oauthData.picture || null,
                is_primary: true,
                last_login_at: sql`NOW()`,
                linked_at: sql`NOW()`,
                created_at: sql`NOW()`,
                updated_at: sql`NOW()`,
            })
            .onConflict((oc) =>
                oc.columns(['customer_user_id', 'provider']).doUpdateSet({
                    provider_user_id: oauthData.providerId,
                    email: oauthData.email || null,
                    display_name: oauthData.name || null,
                    profile_photo_url: oauthData.picture || null,
                    last_login_at: sql`NOW()`,
                    updated_at: sql`NOW()`,
                })
            )
            .execute();
    } catch (error) {
        logger.error('[UserRepository] Failed to link OAuth provider:', error);
        throw error;
    }
}

/**
 * Update user email and/or name
 * Used during OAuth migration to update legacy account info
 *
 * @param userId - User's ID
 * @param email - New email (optional)
 * @param name - New name (optional)
 */
export async function updateUserInfo(
    userId: string,
    email?: string,
    name?: string
): Promise<void> {
    try {
        const updateData: any = {};
        if (email) updateData.email = email;
        if (name) updateData.full_name = name;

        if (Object.keys(updateData).length > 0) {
            await db
                .updateTable('customer_users')
                .set(updateData)
                .where('id', '=', userId)
                .execute();
        }
    } catch (error) {
        logger.error('[UserRepository] Failed to update user info:', error);
        throw error;
    }
}

/**
 * Update user's last login timestamp
 * Called after successful authentication
 *
 * @param userId - The user's ID
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
    try {
        await db
            .updateTable('customer_users')
            .set({ updated_at: sql`NOW()` })
            .where('id', '=', userId)
            .execute();
    } catch (error) {
        logger.error('[UserRepository] Failed to update last login:', error);
        throw error;
    }
}

// ============================================================
// AUTH CONTEXT OPERATIONS
// ============================================================

/**
 * Auth context data (XP, credits, subscription)
 */
export interface UserAuthContext {
    xp: {
        xp_points: number;
        level: string;
        level_progress: number;
    } | null;
    credits: {
        balance: number;
        lifetime_earned: number;
    } | null;
    subscription: {
        status: string;
        expired_at: Date | null;
    } | null;
}

/**
 * Get user's authentication context (XP, credits, subscription)
 * Used after login to build user profile response
 *
 * @param userId - The user's ID
 * @returns User's gamification and subscription data
 */
export async function getUserAuthContext(userId: string): Promise<UserAuthContext> {
    try {
        const [xp, credits, subscription] = await Promise.all([
            db
                .selectFrom('customer_xp')
                .select(['xp_points', 'level', 'level_progress'])
                .where('customer_user_id', '=', userId)
                .executeTakeFirst(),
            db
                .selectFrom('customer_credits')
                .select(['balance', 'lifetime_earned'])
                .where('customer_user_id', '=', userId)
                .executeTakeFirst(),
            db
                .selectFrom('customer_subscriptions')
                .select(['status', 'expired_at'])
                .where('customer_user_id', '=', userId)
                .where('status', '=', 'active')
                .where('expired_at', '>', new Date())
                .executeTakeFirst(),
        ]);

        return {
            xp: xp ?? null,
            credits: credits ?? null,
            subscription: subscription ?? null,
        };
    } catch (error) {
        logger.error('[UserRepository] Failed to get user auth context:', error);
        throw error;
    }
}

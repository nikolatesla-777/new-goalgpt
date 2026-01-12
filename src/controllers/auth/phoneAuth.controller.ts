import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../database/kysely';
import { sql } from 'kysely';
import { generateTokens } from '../../utils/jwt.utils';
import { logger } from '../../utils/logger';

/**
 * Phone Authentication Controller
 * Handles phone-based authentication (existing flow compatible)
 *
 * Note: This controller assumes phone verification (OTP) is handled
 * by the mobile app or an external service. It only handles token generation
 * for already-verified phone numbers.
 */

interface PhoneLoginRequest {
  Body: {
    phone: string; // Phone number in E.164 format (e.g., +905551234567)
    verificationToken?: string; // Optional: OTP or verification token
    deviceInfo?: {
      deviceId: string;
      platform: 'ios' | 'android';
      appVersion: string;
      fcmToken?: string;
    };
  };
}

/**
 * POST /api/auth/phone/login
 * Phone login - Login existing user or create new user
 */
export async function phoneLogin(
  request: FastifyRequest<PhoneLoginRequest>,
  reply: FastifyReply
) {
  try {
    const { phone, deviceInfo } = request.body;

    if (!phone) {
      return reply.status(400).send({
        error: 'PHONE_REQUIRED',
        message: 'Phone number is required',
      });
    }

    // Validate phone format (basic check)
    if (!phone.startsWith('+') || phone.length < 10) {
      return reply.status(400).send({
        error: 'INVALID_PHONE_FORMAT',
        message: 'Phone must be in E.164 format (e.g., +905551234567)',
      });
    }

    // 1. Check if user exists with this phone
    let user = await db
      .selectFrom('customer_users')
      .select(['id', 'email', 'name', 'phone', 'username', 'referral_code', 'created_at'])
      .where('phone', '=', phone)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    let isNewUser = false;
    let userId: string;

    // 2. Create new user if doesn't exist
    if (!user) {
      isNewUser = true;

      await db.transaction().execute(async (trx) => {
        // Generate unique referral code
        const referralCode = `GOAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Create user
        const newUser = await trx
          .insertInto('customer_users')
          .values({
            phone,
            email: null,
            name: null,
            username: null,
            referral_code: referralCode,
            created_at: sql`NOW()`,
            updated_at: sql`NOW()`,
          })
          .returning(['id', 'email', 'name', 'phone', 'username', 'referral_code', 'created_at'])
          .executeTakeFirstOrThrow();

        user = newUser;
        userId = newUser.id;

        // Create OAuth identity for phone
        await trx
          .insertInto('customer_oauth_identities')
          .values({
            customer_user_id: userId,
            provider: 'phone',
            provider_user_id: phone,
            email: null,
            display_name: null,
            profile_photo_url: null,
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
            customer_user_id: userId,
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
            customer_user_id: userId,
            balance: 0,
            lifetime_earned: 0,
            lifetime_spent: 0,
            created_at: sql`NOW()`,
            updated_at: sql`NOW()`,
          })
          .execute();

        logger.info('New user created via phone auth:', { userId, phone });
      });
    } else {
      // Existing user
      userId = user.id;

      // Update OAuth identity last login
      await db
        .insertInto('customer_oauth_identities')
        .values({
          customer_user_id: userId,
          provider: 'phone',
          provider_user_id: phone,
          email: null,
          display_name: null,
          profile_photo_url: null,
          is_primary: true,
          last_login_at: sql`NOW()`,
          linked_at: sql`NOW()`,
          created_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .onConflict((oc) =>
          oc.columns(['customer_user_id', 'provider']).doUpdateSet({
            last_login_at: sql`NOW()`,
            updated_at: sql`NOW()`,
          })
        )
        .execute();

      // Update user last login
      await db
        .updateTable('customer_users')
        .set({ updated_at: sql`NOW()` })
        .where('id', '=', userId)
        .execute();

      logger.info('Existing user logged in via phone auth:', { userId, phone });
    }

    // 3. Update FCM token if provided
    if (deviceInfo?.fcmToken) {
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
            token: deviceInfo.fcmToken!,
            platform: deviceInfo.platform,
            app_version: deviceInfo.appVersion || null,
            is_active: true,
            updated_at: sql`NOW()`,
          })
        )
        .execute();
    }

    // 4. Get user profile with XP and Credits
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
        'cu.name',
        'cu.phone',
        'cu.username',
        'cu.referral_code',
        'cu.created_at',
        'xp.xp_points',
        'xp.level',
        'xp.current_streak_days',
        'credits.balance as credit_balance',
        sql<boolean>`CASE WHEN sub.id IS NOT NULL THEN true ELSE false END`.as('is_vip'),
      ])
      .where('cu.id', '=', userId)
      .executeTakeFirstOrThrow();

    // 5. Generate JWT tokens
    const tokens = generateTokens({
      userId: userProfile.id,
      email: userProfile.email,
      phone: userProfile.phone!,
    });

    // 6. Return response
    return reply.status(isNewUser ? 201 : 200).send({
      success: true,
      isNewUser,
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        phone: userProfile.phone,
        username: userProfile.username,
        referralCode: userProfile.referral_code,
        xp: {
          points: userProfile.xp_points || 0,
          level: userProfile.level || 'bronze',
          streakDays: userProfile.current_streak_days || 0,
        },
        credits: {
          balance: userProfile.credit_balance || 0,
        },
        isVip: userProfile.is_vip || false,
        createdAt: userProfile.created_at,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    logger.error('Phone auth error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
interface RefreshTokenRequest {
  Body: {
    refreshToken: string;
  };
}

export async function refreshToken(
  request: FastifyRequest<RefreshTokenRequest>,
  reply: FastifyReply
) {
  try {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.status(400).send({
        error: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const { verifyRefreshToken } = await import('../../utils/jwt.utils');
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err: any) {
      return reply.status(401).send({
        error: err.message || 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }

    // Get user from database
    const user = await db
      .selectFrom('customer_users')
      .select(['id', 'email', 'phone'])
      .where('id', '=', decoded.userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!user) {
      return reply.status(404).send({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      phone: user.phone,
    });

    return reply.status(200).send({
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during token refresh',
    });
  }
}

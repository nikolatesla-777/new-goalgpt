import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../database/kysely';
import { sql } from 'kysely';
import { getFirebaseAuth } from '../../config/firebase.config';
import { generateTokens } from '../../utils/jwt.utils';
import { logger } from '../../utils/logger';

/**
 * Google OAuth Authentication Controller
 * Handles Google Sign In flow with Firebase verification
 */

interface GoogleAuthRequest {
  Body: {
    idToken: string; // Google ID token from client
    deviceInfo?: {
      deviceId: string;
      platform: 'ios' | 'android';
      appVersion: string;
      fcmToken?: string;
    };
  };
}

/**
 * POST /api/auth/google/signin
 * Google Sign In - Verify token and create/login user
 */
export async function googleSignIn(
  request: FastifyRequest<GoogleAuthRequest>,
  reply: FastifyReply
) {
  try {
    const { idToken, deviceInfo } = request.body;

    if (!idToken) {
      return reply.status(400).send({
        error: 'ID_TOKEN_REQUIRED',
        message: 'Google ID token is required',
      });
    }

    // 1. Verify Google ID token with Firebase Admin SDK
    let decodedToken;
    try {
      const firebaseAuth = getFirebaseAuth();
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (err: any) {
      logger.error('Firebase token verification failed:', err);
      return reply.status(401).send({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired Google ID token',
      });
    }

    const { sub: googleId, email, name, picture } = decodedToken;

    if (!email) {
      return reply.status(400).send({
        error: 'EMAIL_REQUIRED',
        message: 'Email is required for registration',
      });
    }

    // 2. Check if user exists with this Google ID
    let user = await db
      .selectFrom('customer_oauth_identities as coi')
      .innerJoin('customer_users as cu', 'cu.id', 'coi.customer_user_id')
      .select([
        'cu.id',
        'cu.email',
        'cu.name',
        'cu.phone',
        'cu.username',
        'cu.referral_code',
        'cu.created_at',
      ])
      .where('coi.provider', '=', 'google')
      .where('coi.provider_user_id', '=', googleId)
      .where('coi.deleted_at', 'is', null)
      .where('cu.deleted_at', 'is', null)
      .executeTakeFirst();

    // 3. If not exists, check by email (for linking existing account)
    if (!user) {
      user = await db
        .selectFrom('customer_users')
        .select(['id', 'email', 'name', 'phone', 'username', 'referral_code', 'created_at'])
        .where('email', '=', email)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    }

    let isNewUser = false;
    let userId: string;

    // 4. Create new user if doesn't exist
    if (!user) {
      isNewUser = true;

      await db.transaction().execute(async (trx) => {
        // Generate unique referral code
        const referralCode = `GOAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Create user
        const newUser = await trx
          .insertInto('customer_users')
          .values({
            email,
            name: name || email.split('@')[0],
            google_id: googleId,
            phone: null,
            username: null,
            referral_code: referralCode,
            created_at: sql`NOW()`,
            updated_at: sql`NOW()`,
          })
          .returning(['id', 'email', 'name', 'phone', 'username', 'referral_code', 'created_at'])
          .executeTakeFirstOrThrow();

        user = newUser;
        userId = newUser.id;

        // Create OAuth identity
        await trx
          .insertInto('customer_oauth_identities')
          .values({
            customer_user_id: userId,
            provider: 'google',
            provider_user_id: googleId,
            email,
            display_name: name || null,
            profile_photo_url: picture || null,
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

        logger.info('New user created via Google OAuth:', { userId, email });
      });
    } else {
      // Existing user
      userId = user.id;

      // Update or create OAuth identity (for account linking)
      await db
        .insertInto('customer_oauth_identities')
        .values({
          customer_user_id: userId,
          provider: 'google',
          provider_user_id: googleId,
          email,
          display_name: name || null,
          profile_photo_url: picture || null,
          is_primary: true,
          last_login_at: sql`NOW()`,
          linked_at: sql`NOW()`,
          created_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .onConflict((oc) =>
          oc.columns(['customer_user_id', 'provider']).doUpdateSet({
            provider_user_id: googleId,
            email,
            display_name: name || null,
            profile_photo_url: picture || null,
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

      logger.info('Existing user logged in via Google OAuth:', { userId, email });
    }

    // 5. Update FCM token if provided
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

    // 6. Get user profile with XP and Credits
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

    // 7. Generate JWT tokens
    const tokens = generateTokens({
      userId: userProfile.id,
      email: userProfile.email!,
      phone: userProfile.phone,
    });

    // 8. Return response
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
    logger.error('Google OAuth error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during authentication',
    });
  }
}

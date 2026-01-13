import { FastifyInstance } from 'fastify';
import { googleSignIn } from '../controllers/auth/googleAuth.controller';
import { appleSignIn } from '../controllers/auth/appleAuth.controller';
import { phoneLogin, refreshToken } from '../controllers/auth/phoneAuth.controller';
import { legacyLogin, checkLegacyUser, migrateToOAuth } from '../controllers/auth/legacyAuth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../database/kysely';
import { sql } from 'kysely';

/**
 * Authentication Routes
 * Handles OAuth (Google, Apple) and Phone authentication
 */

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/google/signin
   * Google OAuth Sign In
   *
   * Body:
   * - idToken: string (Google ID token from client)
   * - deviceInfo?: { deviceId, platform, appVersion, fcmToken }
   *
   * Response:
   * - success: boolean
   * - isNewUser: boolean
   * - user: { id, email, name, xp, credits, isVip, ... }
   * - tokens: { accessToken, refreshToken, expiresIn }
   */
  fastify.post('/google/signin', googleSignIn);

  /**
   * POST /api/auth/apple/signin
   * Apple Sign In
   *
   * Body:
   * - idToken: string (Apple ID token from client)
   * - email?: string (only on first sign in)
   * - name?: string (only on first sign in)
   * - deviceInfo?: { deviceId, platform, appVersion, fcmToken }
   *
   * Response:
   * - success: boolean
   * - isNewUser: boolean
   * - user: { id, email, name, xp, credits, isVip, ... }
   * - tokens: { accessToken, refreshToken, expiresIn }
   */
  fastify.post('/apple/signin', appleSignIn);

  /**
   * POST /api/auth/phone/login
   * Phone Number Login
   *
   * Body:
   * - phone: string (E.164 format, e.g., +905551234567)
   * - verificationToken?: string (optional OTP)
   * - deviceInfo?: { deviceId, platform, appVersion, fcmToken }
   *
   * Response:
   * - success: boolean
   * - isNewUser: boolean
   * - user: { id, phone, name, xp, credits, isVip, ... }
   * - tokens: { accessToken, refreshToken, expiresIn }
   */
  fastify.post('/phone/login', phoneLogin);

  /**
   * POST /api/auth/refresh
   * Refresh Access Token
   *
   * Body:
   * - refreshToken: string
   *
   * Response:
   * - success: boolean
   * - tokens: { accessToken, refreshToken, expiresIn }
   */
  fastify.post('/refresh', refreshToken);

  /**
   * GET /api/auth/me
   * Get Current User Profile (Protected Route)
   *
   * Headers:
   * - Authorization: Bearer <accessToken>
   *
   * Response:
   * - success: boolean
   * - user: { id, email, name, phone, xp, credits, isVip, ... }
   */
  fastify.get(
    '/me',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;

        // Get full user profile with XP, Credits, and Subscription
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
          .executeTakeFirstOrThrow();

        return reply.status(200).send({
          success: true,
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
              levelProgress: userProfile.level_progress || 0,
              streakDays: userProfile.current_streak_days || 0,
              longestStreak: userProfile.longest_streak_days || 0,
              totalEarned: userProfile.total_xp_earned || 0,
            },
            credits: {
              balance: userProfile.credit_balance || 0,
              lifetimeEarned: userProfile.credits_lifetime_earned || 0,
              lifetimeSpent: userProfile.credits_lifetime_spent || 0,
            },
            vip: {
              isActive: userProfile.is_vip || false,
              expiresAt: userProfile.vip_expires_at,
            },
            createdAt: userProfile.created_at,
          },
        });
      } catch (error) {
        fastify.log.error('Get user profile error:', error);
        return reply.status(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user profile',
        });
      }
    }
  );

  /**
   * POST /api/auth/logout
   * Logout (Invalidate FCM Token) - Protected Route
   *
   * Headers:
   * - Authorization: Bearer <accessToken>
   *
   * Body:
   * - deviceId?: string (optional - to invalidate specific device)
   *
   * Response:
   * - success: boolean
   */
  fastify.post(
    '/logout',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const { deviceId } = request.body as { deviceId?: string };

        // Invalidate FCM tokens
        const query = db
          .updateTable('customer_push_tokens')
          .set({ is_active: false, updated_at: sql`NOW()` })
          .where('customer_user_id', '=', userId);

        // If deviceId specified, only invalidate that device
        if (deviceId) {
          await query.where('device_id', '=', deviceId).execute();
        } else {
          // Otherwise invalidate all devices
          await query.execute();
        }

        return reply.status(200).send({
          success: true,
          message: 'Logged out successfully',
        });
      } catch (error) {
        fastify.log.error('Logout error:', error);
        return reply.status(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Logout failed',
        });
      }
    }
  );

  // ============================================================================
  // LEGACY AUTHENTICATION (Backward Compatibility)
  // ============================================================================

  /**
   * POST /api/auth/legacy/login
   * Login with phone + password (existing users)
   *
   * Body:
   * - phone: string (e.g., +905551234567)
   * - password: string
   * - deviceInfo?: { deviceId, platform, appVersion }
   *
   * Response:
   * - success: boolean
   * - user: { ... }
   * - tokens: { accessToken, refreshToken, expiresIn }
   * - migration: { available: true, message: string }
   */
  fastify.post('/legacy/login', legacyLogin);

  /**
   * POST /api/auth/legacy/check
   * Check if phone number has legacy account
   *
   * Body:
   * - phone: string
   *
   * Response:
   * - exists: boolean
   * - hasPassword: boolean
   * - isLegacyUser: boolean
   */
  fastify.post('/legacy/check', checkLegacyUser);

  /**
   * POST /api/auth/legacy/migrate-oauth
   * Migrate legacy account to OAuth (link Google/Apple)
   *
   * Requires: Authentication
   *
   * Body:
   * - oauthProvider: 'google' | 'apple'
   * - oauthUserId: string
   * - email?: string
   * - name?: string
   *
   * Response:
   * - success: boolean
   * - message: string
   * - provider: string
   */
  fastify.post('/legacy/migrate-oauth', { preHandler: requireAuth }, migrateToOAuth);
}

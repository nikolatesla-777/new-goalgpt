import { FastifyInstance } from 'fastify';
import { emailLogin, emailRegister } from '../controllers/auth/emailAuth.controller';
import { googleSignIn } from '../controllers/auth/googleAuth.controller';
import { appleSignIn } from '../controllers/auth/appleAuth.controller';
import { phoneLogin, refreshToken } from '../controllers/auth/phoneAuth.controller';
import { legacyLogin, checkLegacyUser, migrateToOAuth } from '../controllers/auth/legacyAuth.controller';
import { requireAuth } from '../middleware/auth.middleware';
// PR-4: Use repository for all user DB access
import { getUserProfile, deactivatePushTokens } from '../repositories/user.repository';
// PR-11: Deprecation utilities
import { deprecateRoute } from '../utils/deprecation.utils';

/**
 * Authentication Routes
 * Handles OAuth (Google, Apple) and Phone authentication
 */

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/login
   * Email/Password Login
   *
   * Body:
   * - email: string
   * - password: string
   * - deviceInfo?: { deviceId, platform, appVersion, fcmToken }
   *
   * Response:
   * - success: boolean
   * - user: { id, email, name, xp, credits, isVip, ... }
   * - tokens: { accessToken, refreshToken, expiresIn }
   */
  fastify.post('/login', emailLogin);

  /**
   * POST /api/auth/register
   * Email/Password Registration
   *
   * Body:
   * - email: string
   * - password: string
   * - name?: string
   * - deviceInfo?: { deviceId, platform, appVersion, fcmToken }
   *
   * Response:
   * - success: boolean
   * - user: { id, email, name, xp, credits, isVip, ... }
   * - tokens: { accessToken, refreshToken, expiresIn }
   */
  fastify.post('/register', emailRegister);

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
    { preHandler: requireAuth } as any,
    async (request: any, reply: any) => {
      try {
        const userId = request.user!.userId;

        // PR-4: Use repository for DB access
        const userProfile = await getUserProfile(userId);

        if (!userProfile) {
          return reply.status(404).send({
            success: false,
            error: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        return reply.status(200).send({
          success: true,
          user: {
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.name,
            phone: userProfile.phone,
            username: userProfile.username,
            referralCode: userProfile.referral_code,
            role: userProfile.role,
            isVip: userProfile.is_vip || false,
            xp: {
              xpPoints: userProfile.xp_points || 0,
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
            subscription: {
              status: userProfile.is_vip ? 'active' : 'expired',
              expiredAt: userProfile.vip_expires_at ? userProfile.vip_expires_at.toISOString() : null,
            },
            createdAt: userProfile.created_at,
          },
        });
      } catch (error: any) {
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
    { preHandler: requireAuth } as any,
    async (request: any, reply: any) => {
      try {
        const userId = request.user!.userId;
        const { deviceId } = request.body as { deviceId?: string };

        // PR-4: Use repository for DB access
        await deactivatePushTokens(userId, deviceId);

        return reply.status(200).send({
          success: true,
          message: 'Logged out successfully',
        });
      } catch (error: any) {
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
   * PR-11: DEPRECATED - Legacy endpoint for backwards compatibility
   * @deprecated Use POST /api/auth/phone/login instead
   * @sunset 2026-04-24
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
  fastify.post('/legacy/login', async (request, reply) => {
    // PR-11: Add deprecation headers
    deprecateRoute(request, reply, {
      canonical: '/api/auth/phone/login',
      sunset: '2026-04-24T00:00:00Z',
      docs: 'https://docs.goalgpt.app/api/auth/migration',
      message: 'Legacy password authentication is deprecated. Use OTP-based phone login instead.'
    });

    // Call original handler
    return legacyLogin(request as any, reply);
  });

  /**
   * POST /api/auth/legacy/check
   * Check if phone number has legacy account
   *
   * PR-11: DEPRECATED - Legacy endpoint for backwards compatibility
   * @deprecated No direct replacement - modern auth flow handles this internally
   * @sunset 2026-04-24
   *
   * Body:
   * - phone: string
   *
   * Response:
   * - exists: boolean
   * - hasPassword: boolean
   * - isLegacyUser: boolean
   */
  fastify.post('/legacy/check', async (request, reply) => {
    // PR-11: Add deprecation headers
    deprecateRoute(request, reply, {
      canonical: '/api/auth/phone/login',
      sunset: '2026-04-24T00:00:00Z',
      docs: 'https://docs.goalgpt.app/api/auth/migration',
      message: 'Legacy user check is deprecated. Modern auth flow handles legacy accounts automatically.'
    });

    // Call original handler
    return checkLegacyUser(request as any, reply);
  });

  /**
   * POST /api/auth/legacy/migrate-oauth
   * Migrate legacy account to OAuth (link Google/Apple)
   *
   * PR-11: DEPRECATED - Legacy endpoint for backwards compatibility
   * @deprecated OAuth signin endpoints handle migration automatically
   * @sunset 2026-04-24
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
  fastify.post('/legacy/migrate-oauth', { preHandler: requireAuth }, async (request, reply) => {
    // PR-11: Add deprecation headers
    deprecateRoute(request, reply, {
      canonical: '/api/auth/google/signin',
      sunset: '2026-04-24T00:00:00Z',
      docs: 'https://docs.goalgpt.app/api/auth/migration',
      message: 'Manual OAuth migration is deprecated. Use OAuth signin endpoints which handle linking automatically.'
    });

    // Call original handler
    return migrateToOAuth(request as any, reply);
  });
}

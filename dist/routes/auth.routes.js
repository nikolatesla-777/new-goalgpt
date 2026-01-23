"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const emailAuth_controller_1 = require("../controllers/auth/emailAuth.controller");
const googleAuth_controller_1 = require("../controllers/auth/googleAuth.controller");
const appleAuth_controller_1 = require("../controllers/auth/appleAuth.controller");
const phoneAuth_controller_1 = require("../controllers/auth/phoneAuth.controller");
const legacyAuth_controller_1 = require("../controllers/auth/legacyAuth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// PR-4: Use repository for all user DB access
const user_repository_1 = require("../repositories/user.repository");
/**
 * Authentication Routes
 * Handles OAuth (Google, Apple) and Phone authentication
 */
async function authRoutes(fastify) {
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
    fastify.post('/login', emailAuth_controller_1.emailLogin);
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
    fastify.post('/register', emailAuth_controller_1.emailRegister);
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
    fastify.post('/google/signin', googleAuth_controller_1.googleSignIn);
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
    fastify.post('/apple/signin', appleAuth_controller_1.appleSignIn);
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
    fastify.post('/phone/login', phoneAuth_controller_1.phoneLogin);
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
    fastify.post('/refresh', phoneAuth_controller_1.refreshToken);
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
    fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            // PR-4: Use repository for DB access
            const userProfile = await (0, user_repository_1.getUserProfile)(userId);
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
        }
        catch (error) {
            fastify.log.error('Get user profile error:', error);
            return reply.status(500).send({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch user profile',
            });
        }
    });
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
    fastify.post('/logout', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { deviceId } = request.body;
            // PR-4: Use repository for DB access
            await (0, user_repository_1.deactivatePushTokens)(userId, deviceId);
            return reply.status(200).send({
                success: true,
                message: 'Logged out successfully',
            });
        }
        catch (error) {
            fastify.log.error('Logout error:', error);
            return reply.status(500).send({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Logout failed',
            });
        }
    });
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
    fastify.post('/legacy/login', legacyAuth_controller_1.legacyLogin);
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
    fastify.post('/legacy/check', legacyAuth_controller_1.checkLegacyUser);
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
    fastify.post('/legacy/migrate-oauth', { preHandler: auth_middleware_1.requireAuth }, legacyAuth_controller_1.migrateToOAuth);
}

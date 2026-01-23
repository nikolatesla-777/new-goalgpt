"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleSignIn = googleSignIn;
const firebase_config_1 = require("../../config/firebase.config");
const jwt_utils_1 = require("../../utils/jwt.utils");
const logger_1 = require("../../utils/logger");
const referrals_service_1 = require("../../services/referrals.service");
// PR-4: Use repository for all user DB access
const user_repository_1 = require("../../repositories/user.repository");
/**
 * POST /api/auth/google/signin
 * Google Sign In - Verify token and create/login user
 */
async function googleSignIn(request, reply) {
    try {
        const { idToken, referralCode, deviceInfo } = request.body;
        if (!idToken) {
            return reply.status(400).send({
                error: 'ID_TOKEN_REQUIRED',
                message: 'Google ID token is required',
            });
        }
        // 1. Verify Google ID token with Firebase Admin SDK
        let decodedToken;
        try {
            const firebaseAuth = (0, firebase_config_1.getFirebaseAuth)();
            decodedToken = await firebaseAuth.verifyIdToken(idToken);
        }
        catch (err) {
            logger_1.logger.error('Firebase token verification failed:', err);
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
        // PR-4: Use repository for DB access
        let user = await (0, user_repository_1.getUserByOAuthProvider)('google', googleId);
        // 3. If not exists, check by email (for linking existing account)
        if (!user) {
            user = await (0, user_repository_1.getUserByEmail)(email);
        }
        let isNewUser = false;
        let userId;
        // 4. Create new user if doesn't exist
        if (!user) {
            isNewUser = true;
            // PR-4: Use repository for DB access
            user = await (0, user_repository_1.createOAuthUser)({
                provider: 'google',
                providerId: googleId,
                email,
                name: name || email.split('@')[0],
                picture,
            });
            userId = user.id;
            // Apply referral code if provided (for new users only)
            if (referralCode) {
                try {
                    await (0, referrals_service_1.applyReferralCode)(userId, referralCode.toUpperCase());
                    logger_1.logger.info(`Referral code ${referralCode} applied for user ${userId}`);
                }
                catch (refError) {
                    logger_1.logger.warn(`Referral code application failed: ${refError.message}`);
                }
            }
        }
        else {
            // Existing user
            userId = user.id;
            // PR-4: Use repository for DB access
            // Update or create OAuth identity (for account linking)
            await (0, user_repository_1.linkOAuthProvider)(userId, {
                provider: 'google',
                providerId: googleId,
                email,
                name: name || null,
                picture: picture || null,
            });
            // Update user last login
            await (0, user_repository_1.updateUserLastLogin)(userId);
            logger_1.logger.info('Existing user logged in via Google OAuth:', { userId, email });
        }
        // 5. Update FCM token if provided
        // PR-4: Use repository for DB access
        if (deviceInfo?.fcmToken) {
            await (0, user_repository_1.upsertPushToken)(userId, {
                fcmToken: deviceInfo.fcmToken,
                platform: deviceInfo.platform,
                deviceId: deviceInfo.deviceId,
                appVersion: deviceInfo.appVersion,
            });
        }
        // 6. Get user profile with XP and Credits
        // PR-4: Use repository for DB access
        const userProfile = await (0, user_repository_1.getUserProfile)(userId);
        if (!userProfile) {
            return reply.status(500).send({
                error: 'PROFILE_NOT_FOUND',
                message: 'User profile could not be retrieved',
            });
        }
        // 7. Generate JWT tokens
        const tokens = (0, jwt_utils_1.generateTokens)({
            userId: userProfile.id,
            email: userProfile.email,
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
    }
    catch (error) {
        logger_1.logger.error('Google OAuth error:', error);
        return reply.status(500).send({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred during authentication',
        });
    }
}

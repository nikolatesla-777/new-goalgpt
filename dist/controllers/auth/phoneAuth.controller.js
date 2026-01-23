"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneLogin = phoneLogin;
exports.refreshToken = refreshToken;
const jwt_utils_1 = require("../../utils/jwt.utils");
const logger_1 = require("../../utils/logger");
const referrals_service_1 = require("../../services/referrals.service");
// PR-4: Use repository for all user DB access
const user_repository_1 = require("../../repositories/user.repository");
/**
 * POST /api/auth/phone/login
 * Phone login - Login existing user or create new user
 */
async function phoneLogin(request, reply) {
    try {
        const { phone, referralCode, deviceInfo } = request.body;
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
        // PR-4: Use repository for DB access
        let user = await (0, user_repository_1.getUserByPhone)(phone);
        let isNewUser = false;
        let userId;
        // 2. Create new user if doesn't exist
        if (!user) {
            isNewUser = true;
            // PR-4: Use repository for DB access
            user = await (0, user_repository_1.createOAuthUser)({
                provider: 'phone',
                providerId: phone,
                email: null,
                name: null,
                picture: null,
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
            // Update OAuth identity last login
            await (0, user_repository_1.linkOAuthProvider)(userId, {
                provider: 'phone',
                providerId: phone,
                email: null,
                name: null,
                picture: null,
            });
            // Update user last login
            await (0, user_repository_1.updateUserLastLogin)(userId);
            logger_1.logger.info('Existing user logged in via phone auth:', { userId, phone });
        }
        // 3. Update FCM token if provided
        // PR-4: Use repository for DB access
        if (deviceInfo?.fcmToken) {
            await (0, user_repository_1.upsertPushToken)(userId, {
                fcmToken: deviceInfo.fcmToken,
                platform: deviceInfo.platform,
                deviceId: deviceInfo.deviceId,
                appVersion: deviceInfo.appVersion,
            });
        }
        // 4. Get user profile with XP and Credits
        // PR-4: Use repository for DB access
        const userProfile = await (0, user_repository_1.getUserProfile)(userId);
        if (!userProfile) {
            return reply.status(500).send({
                error: 'PROFILE_NOT_FOUND',
                message: 'User profile could not be retrieved',
            });
        }
        // 5. Generate JWT tokens
        const tokens = (0, jwt_utils_1.generateTokens)({
            userId: userProfile.id,
            email: userProfile.email || '', // Phone users may not have email
            phone: userProfile.phone,
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
    }
    catch (error) {
        logger_1.logger.error('Phone auth error:', error);
        return reply.status(500).send({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred during authentication',
        });
    }
}
async function refreshToken(request, reply) {
    try {
        const { refreshToken } = request.body;
        if (!refreshToken) {
            return reply.status(400).send({
                error: 'REFRESH_TOKEN_REQUIRED',
                message: 'Refresh token is required',
            });
        }
        // Verify refresh token
        const { verifyRefreshToken } = await Promise.resolve().then(() => __importStar(require('../../utils/jwt.utils')));
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        }
        catch (err) {
            return reply.status(401).send({
                error: err.message || 'INVALID_REFRESH_TOKEN',
                message: 'Invalid or expired refresh token',
            });
        }
        // Get user from database
        // PR-4: Use repository for DB access
        const user = await (0, user_repository_1.getUserById)(decoded.userId);
        if (!user) {
            return reply.status(404).send({
                error: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }
        // Generate new tokens
        const tokens = (0, jwt_utils_1.generateTokens)({
            userId: user.id,
            email: user.email || '',
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
    }
    catch (error) {
        logger_1.logger.error('Token refresh error:', error);
        return reply.status(500).send({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An error occurred during token refresh',
        });
    }
}

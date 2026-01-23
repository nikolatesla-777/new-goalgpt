"use strict";
/**
 * Legacy Authentication Controller
 * Handles phone + password login for existing users (backward compatibility)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyLogin = legacyLogin;
exports.checkLegacyUser = checkLegacyUser;
exports.migrateToOAuth = migrateToOAuth;
const jwt_utils_1 = require("../../utils/jwt.utils");
const bcrypt_1 = __importDefault(require("bcrypt"));
// PR-4: Use repository for all user DB access
const user_repository_1 = require("../../repositories/user.repository");
// ============================================================================
// LEGACY LOGIN (Phone + Password)
// ============================================================================
/**
 * POST /api/auth/legacy/login
 * Login with phone number and password (existing users)
 */
async function legacyLogin(request, reply) {
    try {
        const { phone, password, deviceInfo } = request.body;
        // Validate input
        if (!phone || !password) {
            return reply.status(400).send({
                error: 'MISSING_CREDENTIALS',
                message: 'Telefon numarası ve şifre gereklidir',
            });
        }
        // PR-4: Use repository for DB access
        // Find user by phone (includes password_hash for verification)
        const user = await (0, user_repository_1.getUserByPhoneWithPassword)(phone);
        if (!user) {
            return reply.status(401).send({
                error: 'INVALID_CREDENTIALS',
                message: 'Geçersiz telefon numarası veya şifre',
            });
        }
        // Check if user has password (legacy account)
        if (!user.password_hash) {
            return reply.status(400).send({
                error: 'NO_PASSWORD_SET',
                message: 'Bu hesap için şifre ayarlanmamış. Lütfen SMS ile giriş yapın.',
                suggestOAuth: true,
            });
        }
        // Verify password
        const passwordMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!passwordMatch) {
            return reply.status(401).send({
                error: 'INVALID_CREDENTIALS',
                message: 'Geçersiz telefon numarası veya şifre',
            });
        }
        // PR-4: Use repository for last login update
        await (0, user_repository_1.updateUserLastLogin)(user.id);
        // PR-4: Use repository for auth context (XP, credits, subscription)
        const authContext = await (0, user_repository_1.getUserAuthContext)(user.id);
        // Generate JWT tokens
        const tokens = (0, jwt_utils_1.generateTokens)({
            userId: user.id,
            email: user.email || '', // Legacy users may not have email
            phone: user.phone,
        });
        // Return user profile
        return reply.send({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                name: user.name,
                username: user.username,
                profilePhotoUrl: user.profile_image_url,
                referralCode: user.referral_code,
                createdAt: user.created_at,
                isNewUser: false,
                hasPassword: true, // Indicate legacy account
                xp: authContext.xp
                    ? {
                        xpPoints: authContext.xp.xp_points,
                        level: authContext.xp.level,
                        levelProgress: Number(authContext.xp.level_progress),
                    }
                    : undefined,
                credits: authContext.credits
                    ? {
                        balance: authContext.credits.balance,
                        lifetimeEarned: authContext.credits.lifetime_earned,
                    }
                    : undefined,
                subscription: authContext.subscription
                    ? {
                        status: authContext.subscription.status,
                        expiredAt: authContext.subscription.expired_at,
                    }
                    : undefined,
            },
            tokens,
            migration: {
                available: true,
                message: 'Google veya Apple hesabınızla bağlantı kurabilirsiniz',
            },
        });
    }
    catch (error) {
        console.error('❌ Legacy login error:', error);
        return reply.status(500).send({
            error: 'LOGIN_FAILED',
            message: 'Giriş işlemi başarısız oldu. Lütfen tekrar deneyin.',
        });
    }
}
// ============================================================================
// CHECK LEGACY USER
// ============================================================================
/**
 * POST /api/auth/legacy/check
 * Check if phone number has legacy account (with password)
 */
async function checkLegacyUser(request, reply) {
    try {
        const { phone } = request.body;
        if (!phone) {
            return reply.status(400).send({
                error: 'MISSING_PHONE',
                message: 'Telefon numarası gereklidir',
            });
        }
        // PR-4: Use repository for DB access
        const user = await (0, user_repository_1.getUserByPhoneWithPassword)(phone);
        if (!user) {
            return reply.send({
                exists: false,
                hasPassword: false,
                isLegacyUser: false,
            });
        }
        return reply.send({
            exists: true,
            hasPassword: !!user.password_hash,
            isLegacyUser: !!user.password_hash,
            registeredAt: user.created_at,
        });
    }
    catch (error) {
        console.error('❌ Check legacy user error:', error);
        return reply.status(500).send({
            error: 'CHECK_FAILED',
            message: 'Kullanıcı kontrolü başarısız oldu',
        });
    }
}
// ============================================================================
// MIGRATE TO OAUTH
// ============================================================================
/**
 * POST /api/auth/legacy/migrate-oauth
 * Migrate legacy account to OAuth (link Google/Apple account)
 */
async function migrateToOAuth(request, reply) {
    try {
        // Require authentication
        if (!request.user) {
            return reply.status(401).send({
                error: 'UNAUTHORIZED',
                message: 'Bu işlem için giriş yapmalısınız',
            });
        }
        const { oauthProvider, oauthUserId, email, name } = request.body;
        const userId = request.user.userId;
        // Validate input
        if (!oauthProvider || !oauthUserId) {
            return reply.status(400).send({
                error: 'MISSING_OAUTH_DATA',
                message: 'OAuth bilgileri gereklidir',
            });
        }
        // PR-4: Use repository for DB access
        // Check if OAuth identity already exists
        const existingOAuth = await (0, user_repository_1.getOAuthIdentity)(oauthProvider, oauthUserId);
        if (existingOAuth && existingOAuth.customer_user_id !== userId) {
            return reply.status(409).send({
                error: 'OAUTH_ALREADY_LINKED',
                message: 'Bu hesap başka bir kullanıcıya bağlı',
            });
        }
        if (existingOAuth && existingOAuth.customer_user_id === userId) {
            return reply.status(200).send({
                success: true,
                message: 'Hesap zaten bağlı',
                alreadyLinked: true,
            });
        }
        // PR-4: Use repository to link OAuth provider
        await (0, user_repository_1.linkOAuthProvider)(userId, {
            provider: oauthProvider,
            providerId: oauthUserId,
            email: email || null,
            name: name || null,
            picture: null,
        });
        // PR-4: Use repository to update user email/name if provided
        if (email || name) {
            await (0, user_repository_1.updateUserInfo)(userId, email, name);
        }
        return reply.send({
            success: true,
            message: `${oauthProvider === 'google' ? 'Google' : 'Apple'} hesabınız başarıyla bağlandı`,
            provider: oauthProvider,
        });
    }
    catch (error) {
        console.error('❌ Migrate to OAuth error:', error);
        return reply.status(500).send({
            error: 'MIGRATION_FAILED',
            message: 'Hesap bağlama işlemi başarısız oldu',
        });
    }
}

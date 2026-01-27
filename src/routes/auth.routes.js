"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
var emailAuth_controller_1 = require("../controllers/auth/emailAuth.controller");
var googleAuth_controller_1 = require("../controllers/auth/googleAuth.controller");
var appleAuth_controller_1 = require("../controllers/auth/appleAuth.controller");
var phoneAuth_controller_1 = require("../controllers/auth/phoneAuth.controller");
var legacyAuth_controller_1 = require("../controllers/auth/legacyAuth.controller");
var auth_middleware_1 = require("../middleware/auth.middleware");
// PR-4: Use repository for all user DB access
var user_repository_1 = require("../repositories/user.repository");
// PR-10: Schema validation
var validation_middleware_1 = require("../middleware/validation.middleware");
var auth_schema_1 = require("../schemas/auth.schema");
// PR-11: Deprecation utilities
var deprecation_utils_1 = require("../utils/deprecation.utils");
/**
 * Authentication Routes
 * Handles OAuth (Google, Apple) and Phone authentication
 */
function authRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
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
            fastify.post('/login', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.emailLoginSchema })] }, emailAuth_controller_1.emailLogin);
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
            fastify.post('/register', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.emailRegisterSchema })] }, emailAuth_controller_1.emailRegister);
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
            fastify.post('/google/signin', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.googleSignInSchema })] }, googleAuth_controller_1.googleSignIn);
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
            fastify.post('/apple/signin', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.appleSignInSchema })] }, appleAuth_controller_1.appleSignIn);
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
            fastify.post('/phone/login', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.phoneLoginSchema })] }, phoneAuth_controller_1.phoneLogin);
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
            fastify.post('/refresh', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.refreshTokenSchema })] }, phoneAuth_controller_1.refreshToken);
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
            fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, userProfile, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, user_repository_1.getUserProfile)(userId)];
                        case 1:
                            userProfile = _a.sent();
                            if (!userProfile) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'USER_NOT_FOUND',
                                        message: 'User not found',
                                    })];
                            }
                            return [2 /*return*/, reply.status(200).send({
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
                                })];
                        case 2:
                            error_1 = _a.sent();
                            fastify.log.error('Get user profile error:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    error: 'INTERNAL_SERVER_ERROR',
                                    message: 'Failed to fetch user profile',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
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
            fastify.post('/logout', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ body: auth_schema_1.logoutSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, deviceId, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            deviceId = request.body.deviceId;
                            // PR-4: Use repository for DB access
                            return [4 /*yield*/, (0, user_repository_1.deactivatePushTokens)(userId, deviceId)];
                        case 1:
                            // PR-4: Use repository for DB access
                            _a.sent();
                            return [2 /*return*/, reply.status(200).send({
                                    success: true,
                                    message: 'Logged out successfully',
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('Logout error:', error_2);
                            return [2 /*return*/, reply.status(500).send({
                                    error: 'INTERNAL_SERVER_ERROR',
                                    message: 'Logout failed',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
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
            fastify.post('/legacy/login', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.legacyLoginSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // PR-11: Add deprecation headers
                    (0, deprecation_utils_1.deprecateRoute)(request, reply, {
                        canonical: '/api/auth/phone/login',
                        sunset: '2026-04-24T00:00:00Z',
                        docs: 'https://docs.goalgpt.app/api/auth/migration',
                        message: 'Legacy password authentication is deprecated. Use OTP-based phone login instead.'
                    });
                    // Call original handler
                    return [2 /*return*/, (0, legacyAuth_controller_1.legacyLogin)(request, reply)];
                });
            }); });
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
            fastify.post('/legacy/check', { preHandler: [(0, validation_middleware_1.validate)({ body: auth_schema_1.legacyCheckSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // PR-11: Add deprecation headers
                    (0, deprecation_utils_1.deprecateRoute)(request, reply, {
                        canonical: '/api/auth/phone/login',
                        sunset: '2026-04-24T00:00:00Z',
                        docs: 'https://docs.goalgpt.app/api/auth/migration',
                        message: 'Legacy user check is deprecated. Modern auth flow handles legacy accounts automatically.'
                    });
                    // Call original handler
                    return [2 /*return*/, (0, legacyAuth_controller_1.checkLegacyUser)(request, reply)];
                });
            }); });
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
            fastify.post('/legacy/migrate-oauth', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ body: auth_schema_1.migrateOAuthSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // PR-11: Add deprecation headers
                    (0, deprecation_utils_1.deprecateRoute)(request, reply, {
                        canonical: '/api/auth/google/signin',
                        sunset: '2026-04-24T00:00:00Z',
                        docs: 'https://docs.goalgpt.app/api/auth/migration',
                        message: 'Manual OAuth migration is deprecated. Use OAuth signin endpoints which handle linking automatically.'
                    });
                    // Call original handler
                    return [2 /*return*/, (0, legacyAuth_controller_1.migrateToOAuth)(request, reply)];
                });
            }); });
            return [2 /*return*/];
        });
    });
}

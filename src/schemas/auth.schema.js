"use strict";
/**
 * Auth Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for all auth.routes.ts endpoints.
 * These are HIGH PRIORITY as auth endpoints are public and accept untrusted input.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateOAuthSchema = exports.legacyCheckSchema = exports.legacyLoginSchema = exports.logoutSchema = exports.refreshTokenSchema = exports.phoneLoginSchema = exports.appleSignInSchema = exports.googleSignInSchema = exports.emailRegisterSchema = exports.emailLoginSchema = void 0;
var zod_1 = require("zod");
var common_1 = require("./common");
// ============================================================
// EMAIL AUTH
// ============================================================
/**
 * POST /api/auth/login
 * Email + password login
 */
exports.emailLoginSchema = zod_1.z.object({
    email: common_1.emailSchema,
    password: common_1.passwordSchema,
    deviceInfo: common_1.deviceInfoSchema.optional(),
});
/**
 * POST /api/auth/register
 * Email registration
 */
exports.emailRegisterSchema = zod_1.z.object({
    email: common_1.emailSchema,
    password: common_1.passwordSchema,
    name: zod_1.z.string().min(1).max(100).optional(),
    deviceInfo: common_1.deviceInfoSchema.optional(),
});
// ============================================================
// OAUTH
// ============================================================
/**
 * POST /api/auth/google/signin
 * Google OAuth sign-in
 */
exports.googleSignInSchema = zod_1.z.object({
    idToken: common_1.nonEmptyStringSchema.describe('Google ID token from OAuth flow'),
    accessToken: zod_1.z.string().optional(),
    deviceInfo: common_1.deviceInfoSchema.optional(),
});
/**
 * POST /api/auth/apple/signin
 * Apple Sign-In
 */
exports.appleSignInSchema = zod_1.z.object({
    idToken: common_1.nonEmptyStringSchema.describe('Apple identity token'),
    authorizationCode: zod_1.z.string().optional(),
    user: zod_1.z.object({
        email: common_1.emailSchema.optional(),
        name: zod_1.z.object({
            firstName: zod_1.z.string().optional(),
            lastName: zod_1.z.string().optional(),
        }).optional(),
    }).optional(),
    deviceInfo: common_1.deviceInfoSchema.optional(),
});
// ============================================================
// PHONE AUTH
// ============================================================
/**
 * POST /api/auth/phone/login
 * Phone number login/registration
 */
exports.phoneLoginSchema = zod_1.z.object({
    phone: common_1.phoneSchema,
    verificationCode: zod_1.z.string().min(4).max(8).optional(),
    deviceInfo: common_1.deviceInfoSchema.optional(),
});
// ============================================================
// TOKEN MANAGEMENT
// ============================================================
/**
 * POST /api/auth/refresh
 * Refresh access token
 */
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: common_1.nonEmptyStringSchema.describe('JWT refresh token'),
});
/**
 * POST /api/auth/logout
 * Logout and invalidate tokens
 */
exports.logoutSchema = zod_1.z.object({
    deviceId: zod_1.z.string().optional(),
    allDevices: zod_1.z.boolean().optional(),
});
// ============================================================
// LEGACY AUTH
// ============================================================
/**
 * POST /api/auth/legacy/login
 * Legacy phone + password login (for migration)
 */
exports.legacyLoginSchema = zod_1.z.object({
    phone: common_1.phoneSchema,
    password: common_1.passwordSchema,
    deviceInfo: common_1.deviceInfoSchema.optional(),
});
/**
 * POST /api/auth/legacy/check
 * Check if phone exists in legacy system
 */
exports.legacyCheckSchema = zod_1.z.object({
    phone: common_1.phoneSchema,
});
/**
 * POST /api/auth/legacy/migrate-oauth
 * Migrate legacy account to OAuth
 */
exports.migrateOAuthSchema = zod_1.z.object({
    oauthProvider: zod_1.z.enum(['google', 'apple']),
    oauthUserId: common_1.nonEmptyStringSchema,
    email: common_1.emailSchema.optional(),
    name: zod_1.z.string().optional(),
});

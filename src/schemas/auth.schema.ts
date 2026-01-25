/**
 * Auth Schemas
 *
 * PR-10: Schema Validation
 *
 * Zod schemas for all auth.routes.ts endpoints.
 * These are HIGH PRIORITY as auth endpoints are public and accept untrusted input.
 */

import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  deviceInfoSchema,
  nonEmptyStringSchema,
} from './common';

// ============================================================
// EMAIL AUTH
// ============================================================

/**
 * POST /api/auth/login
 * Email + password login
 */
export const emailLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  deviceInfo: deviceInfoSchema.optional(),
});

/**
 * POST /api/auth/register
 * Email registration
 */
export const emailRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).max(100).optional(),
  deviceInfo: deviceInfoSchema.optional(),
});

// ============================================================
// OAUTH
// ============================================================

/**
 * POST /api/auth/google/signin
 * Google OAuth sign-in
 */
export const googleSignInSchema = z.object({
  idToken: nonEmptyStringSchema.describe('Google ID token from OAuth flow'),
  accessToken: z.string().optional(),
  deviceInfo: deviceInfoSchema.optional(),
});

/**
 * POST /api/auth/apple/signin
 * Apple Sign-In
 */
export const appleSignInSchema = z.object({
  idToken: nonEmptyStringSchema.describe('Apple identity token'),
  authorizationCode: z.string().optional(),
  user: z.object({
    email: emailSchema.optional(),
    name: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }).optional(),
  }).optional(),
  deviceInfo: deviceInfoSchema.optional(),
});

// ============================================================
// PHONE AUTH
// ============================================================

/**
 * POST /api/auth/phone/login
 * Phone number login/registration
 */
export const phoneLoginSchema = z.object({
  phone: phoneSchema,
  verificationCode: z.string().min(4).max(8).optional(),
  deviceInfo: deviceInfoSchema.optional(),
});

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
export const refreshTokenSchema = z.object({
  refreshToken: nonEmptyStringSchema.describe('JWT refresh token'),
});

/**
 * POST /api/auth/logout
 * Logout and invalidate tokens
 */
export const logoutSchema = z.object({
  deviceId: z.string().optional(),
  allDevices: z.boolean().optional(),
});

// ============================================================
// LEGACY AUTH
// ============================================================

/**
 * POST /api/auth/legacy/login
 * Legacy phone + password login (for migration)
 */
export const legacyLoginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  deviceInfo: deviceInfoSchema.optional(),
});

/**
 * POST /api/auth/legacy/check
 * Check if phone exists in legacy system
 */
export const legacyCheckSchema = z.object({
  phone: phoneSchema,
});

/**
 * POST /api/auth/legacy/migrate-oauth
 * Migrate legacy account to OAuth
 */
export const migrateOAuthSchema = z.object({
  oauthProvider: z.enum(['google', 'apple']),
  oauthUserId: nonEmptyStringSchema,
  email: emailSchema.optional(),
  name: z.string().optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type EmailLoginInput = z.infer<typeof emailLoginSchema>;
export type EmailRegisterInput = z.infer<typeof emailRegisterSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type AppleSignInInput = z.infer<typeof appleSignInSchema>;
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type LegacyLoginInput = z.infer<typeof legacyLoginSchema>;
export type LegacyCheckInput = z.infer<typeof legacyCheckSchema>;
export type MigrateOAuthInput = z.infer<typeof migrateOAuthSchema>;

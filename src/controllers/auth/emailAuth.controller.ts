/**
 * Email/Password Authentication Controller
 * Handles email + password registration and login
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { generateTokens } from '../../utils/jwt.utils';
import * as bcrypt from 'bcrypt';
import { applyReferralCode } from '../../services/referrals.service';
// PR-4: Use repository for all user DB access
import {
  getUserByEmail,
  getUserByEmailWithPassword,
  createEmailPasswordUser,
  upsertPushToken,
  getUserAuthContext,
} from '../../repositories/user.repository';

// ============================================================================
// TYPES
// ============================================================================

interface EmailLoginBody {
  email: string;
  password: string;
  deviceInfo?: {
    deviceId: string;
    platform: string;
    appVersion: string;
    fcmToken?: string;
  };
}

interface EmailRegisterBody {
  email: string;
  password: string;
  name?: string;
  referralCode?: string; // Promosyon kodu (opsiyonel)
  deviceInfo?: {
    deviceId: string;
    platform: string;
    appVersion: string;
    fcmToken?: string;
  };
}

// ============================================================================
// EMAIL/PASSWORD REGISTRATION
// ============================================================================

/**
 * POST /api/auth/register
 * Register new user with email and password
 */
export async function emailRegister(
  request: FastifyRequest<{ Body: EmailRegisterBody }>,
  reply: FastifyReply
) {
  try {
    const { email, password, name, referralCode, deviceInfo } = request.body;

    // Validate input
    if (!email || !password) {
      return reply.status(400).send({
        error: 'MISSING_CREDENTIALS',
        message: 'Email ve şifre gereklidir',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.status(400).send({
        error: 'INVALID_EMAIL',
        message: 'Geçersiz email formatı',
      });
    }

    // Validate password length
    if (password.length < 6) {
      return reply.status(400).send({
        error: 'WEAK_PASSWORD',
        message: 'Şifre en az 6 karakter olmalıdır',
      });
    }

    // PR-4: Use repository for DB access
    // Check if email already exists
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      return reply.status(409).send({
        error: 'EMAIL_EXISTS',
        message: 'Bu email adresi zaten kayıtlı',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // PR-4: Use repository for user creation (includes XP + Credits with 100 welcome bonus)
    const newUser = await createEmailPasswordUser(email, hashedPassword, name || null);

    // Apply referral code if provided
    let referralApplied = false;
    if (referralCode) {
      try {
        await applyReferralCode(newUser.id, referralCode.toUpperCase());
        referralApplied = true;
        request.log.info(`Referral code ${referralCode} applied for user ${newUser.id}`);
      } catch (refError: any) {
        // Log but don't fail registration if referral fails
        request.log.warn(`Referral code application failed: ${refError.message}`);
      }
    }

    // PR-4: Use repository for FCM token upsert
    if (deviceInfo?.fcmToken && deviceInfo?.platform) {
      // Only store push tokens for mobile platforms
      if (deviceInfo.platform === 'ios' || deviceInfo.platform === 'android') {
        await upsertPushToken(newUser.id, {
          fcmToken: deviceInfo.fcmToken,
          platform: deviceInfo.platform,
          deviceId: deviceInfo.deviceId || 'unknown',
          appVersion: deviceInfo.appVersion,
        });
      }
    }

    // PR-4: Use repository for auth context (XP, credits, subscription)
    const authContext = await getUserAuthContext(newUser.id);

    // Generate JWT tokens
    const tokens = generateTokens({
      userId: newUser.id,
      email: email, // Use input email (guaranteed non-null)
      phone: newUser.phone,
    });

    // Return user profile
    return reply.status(201).send({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email || null,
        phone: newUser.phone,
        name: newUser.name,
        username: newUser.username,
        profilePhotoUrl: null,
        referralCode: newUser.referral_code,
        referralApplied,
        createdAt: newUser.created_at,
        isNewUser: true,
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
            expiredAt: authContext.subscription.expired_at?.toISOString() || null,
          }
          : {
            status: 'expired',
            expiredAt: null,
          },
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 86400, // 24 hours
      },
    });
  } catch (error: unknown) {
    request.log.error('Email registration error:');
    request.log.error(error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Kayıt işlemi başarısız oldu',
    });
  }
}

// ============================================================================
// EMAIL/PASSWORD LOGIN
// ============================================================================

/**
 * POST /api/auth/login
 * Login with email and password
 */
export async function emailLogin(
  request: FastifyRequest<{ Body: EmailLoginBody }>,
  reply: FastifyReply
) {
  try {
    const { email, password, deviceInfo } = request.body;

    // Validate input
    if (!email || !password) {
      return reply.status(400).send({
        error: 'MISSING_CREDENTIALS',
        message: 'Email ve şifre gereklidir',
      });
    }

    // PR-4: Use repository for DB access
    // Find user by email (includes password_hash for verification)
    const user = await getUserByEmailWithPassword(email);

    if (!user) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Geçersiz email veya şifre',
      });
    }

    // Check if user has password
    if (!user.password_hash) {
      return reply.status(400).send({
        error: 'NO_PASSWORD_SET',
        message: 'Bu hesap için şifre ayarlanmamış. Lütfen sosyal giriş kullanın.',
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Geçersiz email veya şifre',
      });
    }

    // PR-4: Use repository for FCM token upsert
    if (deviceInfo?.fcmToken && deviceInfo?.platform) {
      // Only store push tokens for mobile platforms
      if (deviceInfo.platform === 'ios' || deviceInfo.platform === 'android') {
        await upsertPushToken(user.id, {
          fcmToken: deviceInfo.fcmToken,
          platform: deviceInfo.platform,
          deviceId: deviceInfo.deviceId || 'unknown',
          appVersion: deviceInfo.appVersion,
        });
      }
    }

    // PR-4: Use repository for auth context (XP, credits, subscription)
    const authContext = await getUserAuthContext(user.id);

    // Generate JWT tokens
    const tokens = generateTokens({
      userId: user.id,
      email: email, // Use input email (guaranteed non-null)
      phone: user.phone,
    });

    // Return user profile
    return reply.send({
      success: true,
      user: {
        id: user.id,
        email: user.email || null,
        phone: user.phone,
        name: user.name,
        username: user.username,
        profilePhotoUrl: null,
        referralCode: user.referral_code,
        createdAt: user.created_at,
        isNewUser: false,
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
            expiredAt: authContext.subscription.expired_at?.toISOString() || null,
          }
          : {
            status: 'expired',
            expiredAt: null,
          },
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 86400, // 24 hours
      },
    });
  } catch (error: unknown) {
    request.log.error('Email login error:');
    request.log.error(error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Giriş işlemi başarısız oldu',
    });
  }
}


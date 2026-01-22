/**
 * Email/Password Authentication Controller
 * Handles email + password registration and login
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../database/kysely';
import { generateTokens } from '../../utils/jwt.utils';
import * as bcrypt from 'bcrypt';
import { applyReferralCode } from '../../services/referrals.service';

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

    // Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await db
      .selectFrom('customer_users')
      .select('id')
      .where('email', '=', normalizedEmail)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (existingUser) {
      return reply.status(409).send({
        error: 'EMAIL_EXISTS',
        message: 'Bu email adresi zaten kayıtlı',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate user's own referral code
    const userReferralCode = `GG${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create user
    const newUser = await db
      .insertInto('customer_users')
      .values({
        email: normalizedEmail,
        password_hash: hashedPassword,
        full_name: name || null,
        referral_code: userReferralCode,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning(['id', 'email', 'phone', 'full_name', 'username', 'referral_code', 'created_at'])
      .executeTakeFirstOrThrow();

    // Initialize XP for new user
    await db
      .insertInto('customer_xp')
      .values({
        customer_user_id: newUser.id,
        xp_points: 0,
        level: 'bronze',
        level_progress: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
        total_earned: 0,
        achievements_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    // Initialize Credits for new user
    await db
      .insertInto('customer_credits')
      .values({
        customer_user_id: newUser.id,
        balance: 100, // Welcome bonus
        lifetime_earned: 100,
        lifetime_spent: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

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

    // Save FCM token if provided
    if (deviceInfo?.fcmToken && deviceInfo?.platform) {
      const validPlatform = ['ios', 'android', 'web'].includes(deviceInfo.platform)
        ? (deviceInfo.platform as 'ios' | 'android' | 'web')
        : 'web';

      await db
        .insertInto('customer_push_tokens')
        .values({
          customer_user_id: newUser.id,
          token: deviceInfo.fcmToken,
          platform: validPlatform,
          device_id: deviceInfo.deviceId || 'unknown',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc
            .columns(['customer_user_id', 'device_id'])
            .doUpdateSet({ token: deviceInfo.fcmToken!, is_active: true, updated_at: new Date() })
        )
        .execute();
    }

    // Get user's XP and credits
    const [xp, credits] = await Promise.all([
      db
        .selectFrom('customer_xp')
        .selectAll()
        .where('customer_user_id', '=', newUser.id)
        .executeTakeFirst(),
      db
        .selectFrom('customer_credits')
        .selectAll()
        .where('customer_user_id', '=', newUser.id)
        .executeTakeFirst(),
    ]);

    // Generate JWT tokens
    const tokens = generateTokens({
      userId: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
    });

    // Return user profile
    return reply.status(201).send({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email || null,
        phone: newUser.phone,
        name: newUser.full_name,
        username: newUser.username,
        profilePhotoUrl: null,
        referralCode: newUser.referral_code,
        referralApplied,
        createdAt: newUser.created_at,
        isNewUser: true,
        xp: xp
          ? {
            xpPoints: xp.xp_points,
            level: xp.level,
            levelProgress: Number(xp.level_progress),
          }
          : undefined,
        credits: credits
          ? {
            balance: credits.balance,
            lifetimeEarned: credits.lifetime_earned,
          }
          : undefined,
        subscription: {
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

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await db
      .selectFrom('customer_users')
      .selectAll()
      .where('email', '=', normalizedEmail)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

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

    // Save FCM token if provided
    if (deviceInfo?.fcmToken && deviceInfo?.platform) {
      const validPlatform = ['ios', 'android', 'web'].includes(deviceInfo.platform)
        ? (deviceInfo.platform as 'ios' | 'android' | 'web')
        : 'web';

      await db
        .insertInto('customer_push_tokens')
        .values({
          customer_user_id: user.id,
          token: deviceInfo.fcmToken,
          platform: validPlatform,
          device_id: deviceInfo.deviceId || 'unknown',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc) =>
          oc
            .columns(['customer_user_id', 'device_id'])
            .doUpdateSet({ token: deviceInfo.fcmToken!, is_active: true, updated_at: new Date() })
        )
        .execute();
    }

    // Get user's XP and credits
    const [xp, credits, subscription] = await Promise.all([
      db
        .selectFrom('customer_xp')
        .selectAll()
        .where('customer_user_id', '=', user.id)
        .executeTakeFirst(),
      db
        .selectFrom('customer_credits')
        .selectAll()
        .where('customer_user_id', '=', user.id)
        .executeTakeFirst(),
      db
        .selectFrom('customer_subscriptions')
        .selectAll()
        .where('customer_user_id', '=', user.id)
        .where('status', '=', 'active')
        .where('expired_at', '>', new Date())
        .executeTakeFirst(),
    ]);

    // Generate JWT tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      phone: user.phone,
    });

    // Return user profile
    return reply.send({
      success: true,
      user: {
        id: user.id,
        email: user.email || null,
        phone: user.phone,
        name: user.full_name,
        username: user.username,
        profilePhotoUrl: null,
        referralCode: user.referral_code,
        createdAt: user.created_at,
        isNewUser: false,
        xp: xp
          ? {
            xpPoints: xp.xp_points,
            level: xp.level,
            levelProgress: Number(xp.level_progress),
          }
          : undefined,
        credits: credits
          ? {
            balance: credits.balance,
            lifetimeEarned: credits.lifetime_earned,
          }
          : undefined,
        subscription: subscription
          ? {
            status: subscription.status,
            expiredAt: subscription.expired_at?.toISOString() || null,
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


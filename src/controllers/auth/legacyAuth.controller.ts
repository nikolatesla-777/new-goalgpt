/**
 * Legacy Authentication Controller
 * Handles phone + password login for existing users (backward compatibility)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../database/kysely';
import { generateTokens } from '../../utils/jwt.utils';
import bcrypt from 'bcrypt';

// ============================================================================
// TYPES
// ============================================================================

interface LegacyLoginBody {
  phone: string;
  password: string;
  deviceInfo?: {
    deviceId: string;
    platform: string;
    appVersion: string;
  };
}

interface MigrateToOAuthBody {
  oauthProvider: 'google' | 'apple';
  oauthUserId: string;
  email?: string;
  name?: string;
}

// ============================================================================
// LEGACY LOGIN (Phone + Password)
// ============================================================================

/**
 * POST /api/auth/legacy/login
 * Login with phone number and password (existing users)
 */
export async function legacyLogin(
  request: FastifyRequest<{ Body: LegacyLoginBody }>,
  reply: FastifyReply
) {
  try {
    const { phone, password, deviceInfo } = request.body;

    // Validate input
    if (!phone || !password) {
      return reply.status(400).send({
        error: 'MISSING_CREDENTIALS',
        message: 'Telefon numarası ve şifre gereklidir',
      });
    }

    // Normalize phone number (remove spaces, dashes)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Find user by phone
    const user = await db
      .selectFrom('customer_users')
      .selectAll()
      .where('phone', '=', normalizedPhone)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!user) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Geçersiz telefon numarası veya şifre',
      });
    }

    // Check if user has password (legacy account)
    if (!user.password) {
      return reply.status(400).send({
        error: 'NO_PASSWORD_SET',
        message: 'Bu hesap için şifre ayarlanmamış. Lütfen SMS ile giriş yapın.',
        suggestOAuth: true,
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Geçersiz telefon numarası veya şifre',
      });
    }

    // Update last login
    await db
      .updateTable('customer_users')
      .set({ last_login_at: new Date() })
      .where('id', '=', user.id)
      .execute();

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
        email: user.email,
        phone: user.phone,
        name: user.name,
        username: user.username,
        profilePhotoUrl: user.profile_photo_url,
        referralCode: user.referral_code,
        createdAt: user.created_at,
        isNewUser: false,
        hasPassword: true, // Indicate legacy account
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
              expiredAt: subscription.expired_at,
            }
          : undefined,
      },
      tokens,
      migration: {
        available: true,
        message: 'Google veya Apple hesabınızla bağlantı kurabilirsiniz',
      },
    });
  } catch (error: any) {
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
export async function checkLegacyUser(
  request: FastifyRequest<{ Body: { phone: string } }>,
  reply: FastifyReply
) {
  try {
    const { phone } = request.body;

    if (!phone) {
      return reply.status(400).send({
        error: 'MISSING_PHONE',
        message: 'Telefon numarası gereklidir',
      });
    }

    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    const user = await db
      .selectFrom('customer_users')
      .select(['id', 'phone', 'password', 'created_at'])
      .where('phone', '=', normalizedPhone)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!user) {
      return reply.send({
        exists: false,
        hasPassword: false,
        isLegacyUser: false,
      });
    }

    return reply.send({
      exists: true,
      hasPassword: !!user.password,
      isLegacyUser: !!user.password,
      registeredAt: user.created_at,
    });
  } catch (error: any) {
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
export async function migrateToOAuth(
  request: FastifyRequest<{ Body: MigrateToOAuthBody }>,
  reply: FastifyReply
) {
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

    // Check if OAuth identity already exists
    const existingOAuth = await db
      .selectFrom('customer_oauth_identities')
      .selectAll()
      .where('provider', '=', oauthProvider)
      .where('provider_user_id', '=', oauthUserId)
      .executeTakeFirst();

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

    // Create OAuth identity
    await db
      .insertInto('customer_oauth_identities')
      .values({
        customer_user_id: userId,
        provider: oauthProvider,
        provider_user_id: oauthUserId,
        email: email || null,
        display_name: name || null,
        is_primary: true,
        linked_at: new Date(),
      })
      .execute();

    // Optionally update user email/name if provided and not set
    const updateData: any = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;

    if (Object.keys(updateData).length > 0) {
      await db
        .updateTable('customer_users')
        .set(updateData)
        .where('id', '=', userId)
        .execute();
    }

    return reply.send({
      success: true,
      message: `${oauthProvider === 'google' ? 'Google' : 'Apple'} hesabınız başarıyla bağlandı`,
      provider: oauthProvider,
    });
  } catch (error: any) {
    console.error('❌ Migrate to OAuth error:', error);
    return reply.status(500).send({
      error: 'MIGRATION_FAILED',
      message: 'Hesap bağlama işlemi başarısız oldu',
    });
  }
}

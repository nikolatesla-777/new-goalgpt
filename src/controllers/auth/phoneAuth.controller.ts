import { FastifyRequest, FastifyReply } from 'fastify';
import { generateTokens } from '../../utils/jwt.utils';
import { logger } from '../../utils/logger';
import { applyReferralCode } from '../../services/referrals.service';
// PR-4: Use repository for all user DB access
import {
  getUserByPhone,
  getUserById,
  createOAuthUser,
  linkOAuthProvider,
  updateUserLastLogin,
  upsertPushToken,
  getUserProfile,
} from '../../repositories/user.repository';

/**
 * Phone Authentication Controller
 * Handles phone-based authentication (existing flow compatible)
 *
 * Note: This controller assumes phone verification (OTP) is handled
 * by the mobile app or an external service. It only handles token generation
 * for already-verified phone numbers.
 */

interface PhoneLoginRequest {
  Body: {
    phone: string; // Phone number in E.164 format (e.g., +905551234567)
    verificationToken?: string; // Optional: OTP or verification token
    referralCode?: string; // Promosyon kodu (opsiyonel)
    deviceInfo?: {
      deviceId: string;
      platform: 'ios' | 'android';
      appVersion: string;
      fcmToken?: string;
    };
  };
}

/**
 * POST /api/auth/phone/login
 * Phone login - Login existing user or create new user
 */
export async function phoneLogin(
  request: FastifyRequest<PhoneLoginRequest>,
  reply: FastifyReply
) {
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
    let user = await getUserByPhone(phone);

    let isNewUser = false;
    let userId: string;

    // 2. Create new user if doesn't exist
    if (!user) {
      isNewUser = true;

      // PR-4: Use repository for DB access
      user = await createOAuthUser({
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
          await applyReferralCode(userId!, referralCode.toUpperCase());
          logger.info(`Referral code ${referralCode} applied for user ${userId}`);
        } catch (refError: any) {
          logger.warn(`Referral code application failed: ${refError.message}`);
        }
      }
    } else {
      // Existing user
      userId = user.id;

      // PR-4: Use repository for DB access
      // Update OAuth identity last login
      await linkOAuthProvider(userId, {
        provider: 'phone',
        providerId: phone,
        email: null,
        name: null,
        picture: null,
      });

      // Update user last login
      await updateUserLastLogin(userId);

      logger.info('Existing user logged in via phone auth:', { userId, phone });
    }

    // 3. Update FCM token if provided
    // PR-4: Use repository for DB access
    if (deviceInfo?.fcmToken) {
      await upsertPushToken(userId, {
        fcmToken: deviceInfo.fcmToken,
        platform: deviceInfo.platform,
        deviceId: deviceInfo.deviceId,
        appVersion: deviceInfo.appVersion,
      });
    }

    // 4. Get user profile with XP and Credits
    // PR-4: Use repository for DB access
    const userProfile = await getUserProfile(userId);

    if (!userProfile) {
      return reply.status(500).send({
        error: 'PROFILE_NOT_FOUND',
        message: 'User profile could not be retrieved',
      });
    }

    // 5. Generate JWT tokens
    const tokens = generateTokens({
      userId: userProfile.id,
      email: userProfile.email || '', // Phone users may not have email
      phone: userProfile.phone!,
      role: userProfile.role,
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
        role: userProfile.role,
        isVip: userProfile.is_vip || false,
        createdAt: userProfile.created_at,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    logger.error('Phone auth error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
interface RefreshTokenRequest {
  Body: {
    refreshToken: string;
  };
}

export async function refreshToken(
  request: FastifyRequest<RefreshTokenRequest>,
  reply: FastifyReply
) {
  try {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.status(400).send({
        error: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const { verifyRefreshToken } = await import('../../utils/jwt.utils');
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err: any) {
      return reply.status(401).send({
        error: err.message || 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }

    // Get user from database
    // PR-4: Use repository for DB access
    const user = await getUserById(decoded.userId);

    if (!user) {
      return reply.status(404).send({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Generate new tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email || '',
      phone: user.phone || undefined,
      role: user.role,
    });

    return reply.status(200).send({
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during token refresh',
    });
  }
}

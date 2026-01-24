import { FastifyRequest, FastifyReply } from 'fastify';
import { getFirebaseAuth } from '../../config/firebase.config';
import { generateTokens } from '../../utils/jwt.utils';
import { logger } from '../../utils/logger';
import { applyReferralCode } from '../../services/referrals.service';
// PR-4: Use repository for all user DB access
import {
  getUserByOAuthProvider,
  getUserByEmail,
  createOAuthUser,
  linkOAuthProvider,
  updateUserLastLogin,
  upsertPushToken,
  getUserProfile,
} from '../../repositories/user.repository';

/**
 * Apple OAuth Authentication Controller
 * Handles Apple Sign In flow with Firebase verification
 */

interface AppleAuthRequest {
  Body: {
    idToken: string; // Apple ID token from client
    email?: string; // Email (only provided on first sign in)
    name?: string; // Full name (only provided on first sign in)
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
 * POST /api/auth/apple/signin
 * Apple Sign In - Verify token and create/login user
 */
export async function appleSignIn(
  request: FastifyRequest<AppleAuthRequest>,
  reply: FastifyReply
) {
  try {
    const { idToken, email: providedEmail, name: providedName, referralCode, deviceInfo } = request.body;

    if (!idToken) {
      return reply.status(400).send({
        error: 'ID_TOKEN_REQUIRED',
        message: 'Apple ID token is required',
      });
    }

    // 1. Verify Apple ID token with Firebase Admin SDK
    let decodedToken;
    try {
      const firebaseAuth = getFirebaseAuth();
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (err: any) {
      logger.error('Firebase Apple token verification failed:', err);
      return reply.status(401).send({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired Apple ID token',
      });
    }

    const { sub: appleId, email: tokenEmail } = decodedToken;

    // Apple may not provide email in token after first sign in
    // Use provided email or token email
    const email = providedEmail || tokenEmail;

    // 2. Check if user exists with this Apple ID
    // PR-4: Use repository for DB access
    let user = await getUserByOAuthProvider('apple', appleId);

    // 3. If not exists and email provided, check by email (for linking)
    if (!user && email) {
      user = await getUserByEmail(email);
    }

    let isNewUser = false;
    let userId: string;

    // 4. Create new user if doesn't exist
    if (!user) {
      // Apple Sign In requires email on first sign in
      if (!email) {
        return reply.status(400).send({
          error: 'EMAIL_REQUIRED',
          message: 'Email is required for first time Apple Sign In',
        });
      }

      isNewUser = true;

      // PR-4: Use repository for DB access
      user = await createOAuthUser({
        provider: 'apple',
        providerId: appleId,
        email,
        name: providedName || email.split('@')[0],
        picture: null, // Apple doesn't provide profile photo
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
      // Update or create OAuth identity (for account linking)
      await linkOAuthProvider(userId, {
        provider: 'apple',
        providerId: appleId,
        email: email || null,
        name: providedName || null,
        picture: null,
      });

      // Update user last login
      await updateUserLastLogin(userId);

      logger.info('Existing user logged in via Apple Sign In:', { userId, email });
    }

    // 5. Update FCM token if provided
    // PR-4: Use repository for DB access
    if (deviceInfo?.fcmToken) {
      await upsertPushToken(userId, {
        fcmToken: deviceInfo.fcmToken,
        platform: deviceInfo.platform,
        deviceId: deviceInfo.deviceId,
        appVersion: deviceInfo.appVersion,
      });
    }

    // 6. Get user profile with XP and Credits
    // PR-4: Use repository for DB access
    const userProfile = await getUserProfile(userId);

    if (!userProfile) {
      return reply.status(500).send({
        error: 'PROFILE_NOT_FOUND',
        message: 'User profile could not be retrieved',
      });
    }

    // 7. Generate JWT tokens
    const tokens = generateTokens({
      userId: userProfile.id,
      email: userProfile.email!,
      phone: userProfile.phone,
      role: userProfile.role,
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
    logger.error('Apple Sign In error:', error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Referral Routes - Referral Program API Endpoints
 *
 * 8 endpoints for referral system
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getUserReferralCode,
  applyReferralCode,
  getReferralStats,
  getUserReferrals,
  getReferralLeaderboard,
  validateReferralCode,
  processReferralTier2,
  processReferralTier3,
} from '../services/referrals.service';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

// Request types
interface ApplyReferralRequest {
  Body: {
    referralCode: string;
  };
}

interface ValidateReferralRequest {
  Body: {
    code: string;
  };
}

interface GetReferralsRequest {
  Querystring: {
    limit?: number;
    offset?: number;
  };
}

interface LeaderboardRequest {
  Querystring: {
    limit?: number;
  };
}

interface ProcessTierRequest {
  Params: {
    userId: string;
  };
}

export async function referralsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/referrals/me/code
   * Get user's referral code (create if doesn't exist)
   * Requires authentication
   */
  fastify.get(
    '/me/code',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const referralCode = await getUserReferralCode(userId);

        return reply.send({
          success: true,
          data: {
            referralCode,
            shareUrl: `https://goalgpt.app/signup?ref=${referralCode}`,
            shareMessage: `GoalGPT'ye katıl ve ${referralCode} kodumu kullan! 🎉`,
          },
        });
      } catch (error: any) {
        fastify.log.error('Get referral code error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_REFERRAL_CODE_FAILED',
          message: error.message || 'Failed to get referral code',
        });
      }
    }
  );

  /**
   * POST /api/referrals/apply
   * Apply referral code during signup (Tier 1)
   * Requires authentication (for new user)
   * Body: { referralCode: string }
   */
  fastify.post<ApplyReferralRequest>(
    '/apply',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const { referralCode } = request.body;

        if (!referralCode) {
          return reply.status(400).send({
            success: false,
            error: 'INVALID_REQUEST',
            message: 'referralCode is required',
          });
        }

        const result = await applyReferralCode(userId, referralCode.toUpperCase());

        return reply.send({
          success: true,
          message: 'Referral code applied successfully',
          data: result.referral,
        });
      } catch (error: any) {
        fastify.log.error('Apply referral code error:', error);

        // Handle specific errors
        if (error.message === 'Invalid referral code') {
          return reply.status(400).send({
            success: false,
            error: 'INVALID_REFERRAL_CODE',
            message: 'Geçersiz referral kodu',
          });
        }

        if (error.message === 'Cannot refer yourself') {
          return reply.status(400).send({
            success: false,
            error: 'SELF_REFERRAL',
            message: 'Kendi kodunu kullanamazsın',
          });
        }

        if (error.message === 'User already has a referral') {
          return reply.status(400).send({
            success: false,
            error: 'ALREADY_REFERRED',
            message: 'Zaten bir referral kodun var',
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'APPLY_REFERRAL_FAILED',
          message: error.message || 'Failed to apply referral code',
        });
      }
    }
  );

  /**
   * GET /api/referrals/me/stats
   * Get user's referral statistics
   * Requires authentication
   */
  fastify.get(
    '/me/stats',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const stats = await getReferralStats(userId);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        fastify.log.error('Get referral stats error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_STATS_FAILED',
          message: error.message || 'Failed to get referral statistics',
        });
      }
    }
  );

  /**
   * GET /api/referrals/me/referrals
   * Get user's referral list
   * Query params: limit (default: 50), offset (default: 0)
   * Requires authentication
   */
  fastify.get<GetReferralsRequest>(
    '/me/referrals',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const limit = Math.min(Number(request.query.limit) || 50, 100);
        const offset = Number(request.query.offset) || 0;

        const referrals = await getUserReferrals(userId, limit, offset);

        return reply.send({
          success: true,
          data: referrals,
          pagination: {
            limit,
            offset,
            total: referrals.length,
          },
        });
      } catch (error: any) {
        fastify.log.error('Get referrals error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_REFERRALS_FAILED',
          message: error.message || 'Failed to get referrals',
        });
      }
    }
  );

  /**
   * GET /api/referrals/leaderboard
   * Get referral leaderboard (top referrers)
   * Query params: limit (default: 100, max: 500)
   */
  fastify.get<LeaderboardRequest>(
    '/leaderboard',
    async (request, reply) => {
      try {
        const limit = Math.min(Number(request.query.limit) || 100, 500);

        const leaderboard = await getReferralLeaderboard(limit);

        return reply.send({
          success: true,
          data: leaderboard,
        });
      } catch (error: any) {
        fastify.log.error('Get referral leaderboard error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_LEADERBOARD_FAILED',
          message: error.message || 'Failed to get referral leaderboard',
        });
      }
    }
  );

  /**
   * POST /api/referrals/validate
   * Validate referral code
   * Body: { code: string }
   * Public endpoint (no auth required)
   */
  fastify.post<ValidateReferralRequest>(
    '/validate',
    async (request, reply) => {
      try {
        const { code } = request.body;

        if (!code) {
          return reply.status(400).send({
            success: false,
            error: 'INVALID_REQUEST',
            message: 'code is required',
          });
        }

        const result = await validateReferralCode(code.toUpperCase());

        return reply.send({
          success: true,
          data: {
            valid: result.valid,
            message: result.valid ? 'Geçerli referral kodu' : 'Geçersiz referral kodu',
          },
        });
      } catch (error: any) {
        fastify.log.error('Validate referral code error:', error);
        return reply.status(500).send({
          success: false,
          error: 'VALIDATE_CODE_FAILED',
          message: error.message || 'Failed to validate referral code',
        });
      }
    }
  );

  /**
   * POST /api/referrals/tier2/:userId
   * Process Tier 2 reward (first login)
   * Admin only - manual trigger
   */
  fastify.post<ProcessTierRequest>(
    '/tier2/:userId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { userId } = request.params;

        const success = await processReferralTier2(userId);

        if (!success) {
          return reply.status(404).send({
            success: false,
            error: 'NO_REFERRAL_FOUND',
            message: 'No active Tier 1 referral found for this user',
          });
        }

        return reply.send({
          success: true,
          message: 'Tier 2 reward processed successfully',
        });
      } catch (error: any) {
        fastify.log.error('Process Tier 2 error:', error);
        return reply.status(500).send({
          success: false,
          error: 'PROCESS_TIER2_FAILED',
          message: error.message || 'Failed to process Tier 2 reward',
        });
      }
    }
  );

  /**
   * POST /api/referrals/tier3/:userId
   * Process Tier 3 reward (subscription purchase)
   * Admin only - manual trigger
   */
  fastify.post<ProcessTierRequest>(
    '/tier3/:userId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { userId } = request.params;

        const success = await processReferralTier3(userId);

        if (!success) {
          return reply.status(404).send({
            success: false,
            error: 'NO_REFERRAL_FOUND',
            message: 'No active Tier 2 referral found for this user',
          });
        }

        return reply.send({
          success: true,
          message: 'Tier 3 reward processed successfully',
        });
      } catch (error: any) {
        fastify.log.error('Process Tier 3 error:', error);
        return reply.status(500).send({
          success: false,
          error: 'PROCESS_TIER3_FAILED',
          message: error.message || 'Failed to process Tier 3 reward',
        });
      }
    }
  );
}

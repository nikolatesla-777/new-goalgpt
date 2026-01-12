/**
 * Daily Rewards Routes - Daily Gift Wheel API Endpoints
 *
 * 5 endpoints for daily rewards system
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getDailyRewardStatus,
  claimDailyReward,
  getDailyRewardHistory,
  getDailyRewardCalendar,
  getDailyRewardStats,
} from '../services/dailyRewards.service';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

// Request types
interface GetHistoryRequest {
  Querystring: {
    limit?: number;
  };
}

export async function dailyRewardsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/daily-rewards/status
   * Get daily reward status for current user
   * Requires authentication
   */
  fastify.get(
    '/status',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const status = await getDailyRewardStatus(userId);

        return reply.send({
          success: true,
          data: status,
        });
      } catch (error: any) {
        fastify.log.error('Get daily reward status error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_STATUS_FAILED',
          message: error.message || 'Failed to get daily reward status',
        });
      }
    }
  );

  /**
   * POST /api/daily-rewards/claim
   * Claim today's daily reward
   * Requires authentication
   */
  fastify.post(
    '/claim',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const result = await claimDailyReward(userId);

        return reply.send({
          success: true,
          message: result.message,
          data: result.reward,
        });
      } catch (error: any) {
        fastify.log.error('Claim daily reward error:', error);

        if (error.message === 'Daily reward already claimed today') {
          return reply.status(400).send({
            success: false,
            error: 'ALREADY_CLAIMED',
            message: 'Bugün zaten ödül aldın',
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'CLAIM_FAILED',
          message: error.message || 'Failed to claim daily reward',
        });
      }
    }
  );

  /**
   * GET /api/daily-rewards/history
   * Get daily reward claim history
   * Query params: limit (default: 30)
   * Requires authentication
   */
  fastify.get<GetHistoryRequest>(
    '/history',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const limit = Math.min(Number(request.query.limit) || 30, 100);

        const history = await getDailyRewardHistory(userId, limit);

        return reply.send({
          success: true,
          data: history,
        });
      } catch (error: any) {
        fastify.log.error('Get daily reward history error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_HISTORY_FAILED',
          message: error.message || 'Failed to get reward history',
        });
      }
    }
  );

  /**
   * GET /api/daily-rewards/calendar
   * Get 7-day reward calendar
   * Public endpoint
   */
  fastify.get(
    '/calendar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const calendar = getDailyRewardCalendar();

        return reply.send({
          success: true,
          data: calendar,
        });
      } catch (error: any) {
        fastify.log.error('Get reward calendar error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_CALENDAR_FAILED',
          message: error.message || 'Failed to get reward calendar',
        });
      }
    }
  );

  /**
   * GET /api/daily-rewards/stats
   * Get daily reward statistics (admin only)
   */
  fastify.get(
    '/stats',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getDailyRewardStats();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        fastify.log.error('Get daily reward stats error:', error);
        return reply.status(500).send({
          success: false,
          error: 'GET_STATS_FAILED',
          message: error.message || 'Failed to get reward statistics',
        });
      }
    }
  );
}

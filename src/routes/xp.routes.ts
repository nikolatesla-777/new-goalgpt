import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import {
  grantXP,
  getUserXP,
  getXPTransactions,
  updateLoginStreak,
  getXPLeaderboard,
  XPTransactionType,
} from '../services/xp.service';
import { logger } from '../utils/logger';

/**
 * XP System Routes
 * All routes require authentication except leaderboard
 */

interface GrantXPRequest {
  Body: {
    userId: string;
    amount: number;
    transactionType: XPTransactionType;
    description?: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: Record<string, any>;
  };
}

interface XPTransactionsRequest {
  Querystring: {
    limit?: string;
    offset?: string;
  };
}

interface LeaderboardRequest {
  Querystring: {
    limit?: string;
  };
}

export async function xpRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/xp/me
   * Get current user's XP profile
   * Protected: Requires authentication
   */
  fastify.get(
    '/me',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const xpData = await getUserXP(userId);

        if (!xpData) {
          return reply.status(404).send({
            success: false,
            error: 'USER_XP_NOT_FOUND',
            message: 'User XP record not found',
          });
        }

        return reply.send({
          success: true,
          data: xpData,
        });
      } catch (error: any) {
        logger.error('Error fetching user XP:', error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/xp/grant
   * Grant XP to a user (admin only)
   * Protected: Requires authentication + admin role
   */
  fastify.post<GrantXPRequest>(
    '/grant',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const { userId, amount, transactionType, description, referenceId, referenceType, metadata } = request.body;

        const result = await grantXP({
          userId,
          amount,
          transactionType,
          description,
          referenceId,
          referenceType,
          metadata,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        logger.error('Error granting XP:', error);
        return reply.status(500).send({
          success: false,
          error: 'GRANT_XP_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/xp/transactions
   * Get current user's XP transaction history
   * Protected: Requires authentication
   */
  fastify.get<XPTransactionsRequest>(
    '/transactions',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const limit = parseInt(request.query.limit || '50', 10);
        const offset = parseInt(request.query.offset || '0', 10);

        const transactions = await getXPTransactions(userId, limit, offset);

        return reply.send({
          success: true,
          data: transactions,
          pagination: {
            limit,
            offset,
            count: transactions.length,
          },
        });
      } catch (error: any) {
        logger.error('Error fetching XP transactions:', error);
        return reply.status(500).send({
          success: false,
          error: 'FETCH_TRANSACTIONS_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/xp/login-streak
   * Update daily login streak for current user
   * Protected: Requires authentication
   */
  fastify.post(
    '/login-streak',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const streakResult = await updateLoginStreak(userId);

        return reply.send({
          success: true,
          data: streakResult,
          message:
            streakResult.xpGranted > 0
              ? `Günlük giriş bonusu kazandın! ${streakResult.xpGranted} XP`
              : 'Bugün zaten giriş yaptın',
        });
      } catch (error: any) {
        logger.error('Error updating login streak:', error);
        return reply.status(500).send({
          success: false,
          error: 'UPDATE_STREAK_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/xp/leaderboard
   * Get global XP leaderboard
   * Public: No authentication required
   */
  fastify.get('/leaderboard', async (request: FastifyRequest<LeaderboardRequest>, reply: FastifyReply) => {
    try {
      const limit = parseInt(request.query.limit || '100', 10);

      const leaderboard = await getXPLeaderboard(limit);

      return reply.send({
        success: true,
        data: leaderboard,
      });
    } catch (error: any) {
      logger.error('Error fetching XP leaderboard:', error);
      return reply.status(500).send({
        success: false,
        error: 'FETCH_LEADERBOARD_FAILED',
        message: error.message,
      });
    }
  });
}

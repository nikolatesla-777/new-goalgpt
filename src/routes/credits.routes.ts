import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import {
  grantCredits,
  spendCredits,
  getUserCredits,
  getCreditTransactions,
  processAdReward,
  purchaseVIPPrediction,
  refundCredits,
  getDailyCreditsStats,
  CreditTransactionType,
} from '../services/credits.service';
import { logger } from '../utils/logger';

/**
 * Credits System Routes
 * All routes require authentication
 */

interface GrantCreditsRequest {
  Body: {
    userId: string;
    amount: number;
    transactionType: CreditTransactionType | string;
    description?: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: Record<string, any>;
  };
}

interface SpendCreditsRequest {
  Body: {
    amount: number;
    transactionType: CreditTransactionType | string;
    description?: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: Record<string, any>;
  };
}

interface CreditTransactionsRequest {
  Querystring: {
    limit?: string;
    offset?: string;
  };
}

interface AdRewardRequest {
  Body: {
    adNetwork: 'admob' | 'facebook' | 'unity';
    adUnitId: string;
    adType: 'rewarded_video' | 'rewarded_interstitial';
    deviceId: string;
  };
}

interface PurchasePredictionRequest {
  Body: {
    predictionId: string;
  };
}

interface RefundCreditsRequest {
  Body: {
    userId: string;
    amount: number;
    reason: string;
    referenceId?: string;
  };
}

export async function creditsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/credits/me
   * Get current user's credit balance and stats
   * Protected: Requires authentication
   */
  fastify.get(
    '/me',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const creditsData = await getUserCredits(userId);

        if (!creditsData) {
          return reply.status(404).send({
            success: false,
            error: 'USER_CREDITS_NOT_FOUND',
            message: 'User credits record not found',
          });
        }

        return reply.send({
          success: true,
          data: creditsData,
        });
      } catch (error: any) {
        logger.error('Error fetching user credits:', error);
        return reply.status(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/credits/grant
   * Grant credits to a user (admin only)
   * Protected: Requires authentication + admin role
   * TODO: Add admin role check middleware
   */
  fastify.post(
    '/grant',
    { preHandler: requireAuth },
    async (request: FastifyRequest<GrantCreditsRequest>, reply: FastifyReply) => {
      try {
        const { userId, amount, transactionType, description, referenceId, referenceType, metadata } = request.body;

        // TODO: Verify admin role
        // if (!request.user!.isAdmin) {
        //   return reply.status(403).send({ error: 'ADMIN_REQUIRED' });
        // }

        const result = await grantCredits({
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
        logger.error('Error granting credits:', error);
        return reply.status(500).send({
          success: false,
          error: 'GRANT_CREDITS_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/credits/spend
   * Spend credits (generic endpoint, use specific endpoints for purchases)
   * Protected: Requires authentication
   */
  fastify.post(
    '/spend',
    { preHandler: requireAuth },
    async (request: FastifyRequest<SpendCreditsRequest>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const { amount, transactionType, description, referenceId, referenceType, metadata } = request.body;

        const result = await spendCredits({
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
        logger.error('Error spending credits:', error);

        // Handle insufficient balance error
        if (error.message.includes('Insufficient credits')) {
          return reply.status(400).send({
            success: false,
            error: 'INSUFFICIENT_CREDITS',
            message: error.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'SPEND_CREDITS_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/credits/transactions
   * Get current user's credit transaction history
   * Protected: Requires authentication
   */
  fastify.get(
    '/transactions',
    { preHandler: requireAuth },
    async (request: FastifyRequest<CreditTransactionsRequest>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const limit = parseInt(request.query.limit || '50', 10);
        const offset = parseInt(request.query.offset || '0', 10);

        const transactions = await getCreditTransactions(userId, limit, offset);

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
        logger.error('Error fetching credit transactions:', error);
        return reply.status(500).send({
          success: false,
          error: 'FETCH_TRANSACTIONS_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/credits/ad-reward
   * Process rewarded ad view and grant credits
   * Protected: Requires authentication
   */
  fastify.post(
    '/ad-reward',
    { preHandler: requireAuth },
    async (request: FastifyRequest<AdRewardRequest>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const { adNetwork, adUnitId, adType, deviceId } = request.body;

        // Extract IP and user agent from request
        const ipAddress = request.ip;
        const userAgent = request.headers['user-agent'];

        const result = await processAdReward(userId, adNetwork, adUnitId, adType, deviceId, ipAddress, userAgent);

        // Return appropriate status based on result
        if (!result.success) {
          return reply.status(429).send({
            success: false,
            error: 'AD_LIMIT_REACHED',
            message: result.message,
          });
        }

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        logger.error('Error processing ad reward:', error);
        return reply.status(500).send({
          success: false,
          error: 'AD_REWARD_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/credits/purchase-prediction
   * Purchase VIP prediction with credits
   * Protected: Requires authentication
   */
  fastify.post(
    '/purchase-prediction',
    { preHandler: requireAuth },
    async (request: FastifyRequest<PurchasePredictionRequest>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const { predictionId } = request.body;

        const result = await purchaseVIPPrediction(userId, predictionId);

        return reply.send({
          success: true,
          data: result,
          message: 'VIP tahmin başarıyla satın alındı',
        });
      } catch (error: any) {
        logger.error('Error purchasing VIP prediction:', error);

        // Handle specific errors
        if (error.message.includes('zaten satın alındı')) {
          return reply.status(400).send({
            success: false,
            error: 'ALREADY_PURCHASED',
            message: error.message,
          });
        }

        if (error.message.includes('Insufficient credits')) {
          return reply.status(400).send({
            success: false,
            error: 'INSUFFICIENT_CREDITS',
            message: error.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'PURCHASE_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/credits/refund
   * Refund credits (admin only)
   * Protected: Requires authentication + admin role
   * TODO: Add admin role check middleware
   */
  fastify.post(
    '/refund',
    { preHandler: requireAuth },
    async (request: FastifyRequest<RefundCreditsRequest>, reply: FastifyReply) => {
      try {
        const { userId, amount, reason, referenceId } = request.body;

        // TODO: Verify admin role
        // if (!request.user!.isAdmin) {
        //   return reply.status(403).send({ error: 'ADMIN_REQUIRED' });
        // }

        const result = await refundCredits(userId, amount, reason, referenceId);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        logger.error('Error refunding credits:', error);
        return reply.status(500).send({
          success: false,
          error: 'REFUND_FAILED',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/credits/daily-stats
   * Get daily credits earned/spent stats for current user
   * Protected: Requires authentication
   */
  fastify.get(
    '/daily-stats',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;

        const stats = await getDailyCreditsStats(userId);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error: any) {
        logger.error('Error fetching daily credits stats:', error);
        return reply.status(500).send({
          success: false,
          error: 'FETCH_STATS_FAILED',
          message: error.message,
        });
      }
    }
  );
}

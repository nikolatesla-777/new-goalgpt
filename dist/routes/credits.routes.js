"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditsRoutes = creditsRoutes;
const auth_middleware_1 = require("../middleware/auth.middleware");
const credits_service_1 = require("../services/credits.service");
const logger_1 = require("../utils/logger");
async function creditsRoutes(fastify) {
    /**
     * GET /api/credits/me
     * Get current user's credit balance and stats
     * Protected: Requires authentication
     */
    fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const creditsData = await (0, credits_service_1.getUserCredits)(userId);
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
        }
        catch (error) {
            logger_1.logger.error('Error fetching user credits:', error);
            return reply.status(500).send({
                success: false,
                error: 'INTERNAL_ERROR',
                message: error.message,
            });
        }
    });
    /**
     * POST /api/credits/grant
     * Grant credits to a user (admin only)
     * Protected: Requires authentication + admin role
     */
    fastify.post('/grant', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, async (request, reply) => {
        try {
            const { userId, amount, transactionType, description, referenceId, referenceType, metadata } = request.body;
            const result = await (0, credits_service_1.grantCredits)({
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
        }
        catch (error) {
            logger_1.logger.error('Error granting credits:', error);
            return reply.status(500).send({
                success: false,
                error: 'GRANT_CREDITS_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * POST /api/credits/spend
     * Spend credits (generic endpoint, use specific endpoints for purchases)
     * Protected: Requires authentication
     */
    fastify.post('/spend', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { amount, transactionType, description, referenceId, referenceType, metadata } = request.body;
            const result = await (0, credits_service_1.spendCredits)({
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
        }
        catch (error) {
            logger_1.logger.error('Error spending credits:', error);
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
    });
    /**
     * GET /api/credits/transactions
     * Get current user's credit transaction history
     * Protected: Requires authentication
     */
    fastify.get('/transactions', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const limit = parseInt(request.query.limit || '50', 10);
            const offset = parseInt(request.query.offset || '0', 10);
            const transactions = await (0, credits_service_1.getCreditTransactions)(userId, limit, offset);
            return reply.send({
                success: true,
                data: transactions,
                pagination: {
                    limit,
                    offset,
                    count: transactions.length,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching credit transactions:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_TRANSACTIONS_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * POST /api/credits/ad-reward
     * Process rewarded ad view and grant credits
     * Protected: Requires authentication
     */
    fastify.post('/ad-reward', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { adNetwork, adUnitId, adType, deviceId } = request.body;
            // Extract IP and user agent from request
            const ipAddress = request.ip;
            const userAgent = request.headers['user-agent'];
            const result = await (0, credits_service_1.processAdReward)(userId, adNetwork, adUnitId, adType, deviceId, ipAddress, userAgent);
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
        }
        catch (error) {
            logger_1.logger.error('Error processing ad reward:', error);
            return reply.status(500).send({
                success: false,
                error: 'AD_REWARD_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * POST /api/credits/purchase-prediction
     * Purchase VIP prediction with credits
     * Protected: Requires authentication
     */
    fastify.post('/purchase-prediction', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const { predictionId } = request.body;
            const result = await (0, credits_service_1.purchaseVIPPrediction)(userId, predictionId);
            return reply.send({
                success: true,
                data: result,
                message: 'VIP tahmin başarıyla satın alındı',
            });
        }
        catch (error) {
            logger_1.logger.error('Error purchasing VIP prediction:', error);
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
    });
    /**
     * POST /api/credits/refund
     * Refund credits (admin only)
     * Protected: Requires authentication + admin role
     */
    fastify.post('/refund', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, async (request, reply) => {
        try {
            const { userId, amount, reason, referenceId } = request.body;
            const result = await (0, credits_service_1.refundCredits)(userId, amount, reason, referenceId);
            return reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            logger_1.logger.error('Error refunding credits:', error);
            return reply.status(500).send({
                success: false,
                error: 'REFUND_FAILED',
                message: error.message,
            });
        }
    });
    /**
     * GET /api/credits/daily-stats
     * Get daily credits earned/spent stats for current user
     * Protected: Requires authentication
     */
    fastify.get('/daily-stats', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const stats = await (0, credits_service_1.getDailyCreditsStats)(userId);
            return reply.send({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching daily credits stats:', error);
            return reply.status(500).send({
                success: false,
                error: 'FETCH_STATS_FAILED',
                message: error.message,
            });
        }
    });
}

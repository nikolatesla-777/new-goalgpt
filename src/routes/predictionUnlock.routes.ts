/**
 * Prediction Unlock Routes
 * 
 * Endpoints for FREE users to unlock predictions with credits
 * 
 * Endpoints:
 * - POST /api/predictions/:id/unlock - Unlock a prediction
 * - GET  /api/predictions/:id/access - Check if user has access
 * - GET  /api/predictions/unlocked   - Get user's unlocked predictions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import {
    unlockPrediction,
    canAccessPrediction,
    getUserUnlockedPredictions,
    getUserUnlockStats,
    UNLOCK_COST,
} from '../services/predictionUnlock.service';
import creditsService from '../services/credits.service';

// ============================================================================
// REQUEST TYPES
// ============================================================================

interface PredictionIdRequest {
    Params: { id: string };
}

// ============================================================================
// ROUTES
// ============================================================================

export async function predictionUnlockRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/predictions/:id/unlock
     * Unlock a prediction using credits
     */
    fastify.post<PredictionIdRequest>(
        '/:id/unlock',
        { preHandler: requireAuth },
        async (request, reply) => {
            try {
                const userId = request.user!.userId;
                const predictionId = request.params.id;

                const result = await unlockPrediction(userId, predictionId);

                if (!result.success) {
                    return reply.status(400).send({
                        success: false,
                        error: result.error || 'UNLOCK_FAILED',
                        message: result.message,
                        newBalance: result.newBalance,
                        unlockCost: UNLOCK_COST,
                    });
                }

                return reply.send({
                    success: true,
                    message: result.message,
                    newBalance: result.newBalance,
                    unlockCost: UNLOCK_COST,
                });
            } catch (error: any) {
                fastify.log.error('Unlock prediction error:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'UNLOCK_FAILED',
                    message: error.message || 'Tahmin kilidi açılamadı',
                });
            }
        }
    );

    /**
     * GET /api/predictions/:id/access
     * Check if user has access to a prediction
     */
    fastify.get<PredictionIdRequest>(
        '/:id/access',
        { preHandler: requireAuth },
        async (request, reply) => {
            try {
                const userId = request.user!.userId;
                const predictionId = request.params.id;

                const hasAccess = await canAccessPrediction(userId, predictionId);
                const creditsData = await creditsService.getUserCredits(userId);
                const balance = creditsData?.balance || 0;

                return reply.send({
                    success: true,
                    hasAccess,
                    unlockCost: UNLOCK_COST,
                    currentBalance: balance,
                    canAfford: balance >= UNLOCK_COST,
                });
            } catch (error: any) {
                fastify.log.error('Check access error:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'CHECK_ACCESS_FAILED',
                    message: error.message || 'Erişim kontrolü başarısız',
                });
            }
        }
    );

    /**
     * GET /api/predictions/unlocked
     * Get list of prediction IDs user has unlocked
     */
    fastify.get(
        '/unlocked',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = request.user!.userId;

                const unlockedIds = await getUserUnlockedPredictions(userId);
                const stats = await getUserUnlockStats(userId);
                const creditsData = await creditsService.getUserCredits(userId);
                const balance = creditsData?.balance || 0;

                return reply.send({
                    success: true,
                    data: {
                        unlockedPredictionIds: unlockedIds,
                        totalUnlocked: stats.totalUnlocked,
                        totalCreditsSpent: stats.totalCreditsSpent,
                        currentBalance: balance,
                        unlockCost: UNLOCK_COST,
                    },
                });
            } catch (error: any) {
                fastify.log.error('Get unlocked predictions error:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'GET_UNLOCKED_FAILED',
                    message: error.message || 'Açılan tahminler alınamadı',
                });
            }
        }
    );

    /**
     * GET /api/predictions/unlock-info
     * Get unlock cost and user balance info
     */
    fastify.get(
        '/unlock-info',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = request.user!.userId;
                const creditsData = await creditsService.getUserCredits(userId);
                const balance = creditsData?.balance || 0;

                return reply.send({
                    success: true,
                    data: {
                        unlockCost: UNLOCK_COST,
                        currentBalance: balance,
                        canAfford: balance >= UNLOCK_COST,
                        predictionsCanUnlock: Math.floor(balance / UNLOCK_COST),
                    },
                });
            } catch (error: any) {
                fastify.log.error('Get unlock info error:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'GET_INFO_FAILED',
                    message: error.message || 'Bilgi alınamadı',
                });
            }
        }
    );
}

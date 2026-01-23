"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictionUnlockRoutes = predictionUnlockRoutes;
const auth_middleware_1 = require("../middleware/auth.middleware");
const predictionUnlock_service_1 = require("../services/predictionUnlock.service");
const credits_service_1 = __importDefault(require("../services/credits.service"));
// ============================================================================
// ROUTES
// ============================================================================
async function predictionUnlockRoutes(fastify) {
    /**
     * POST /api/predictions/:id/unlock
     * Unlock a prediction using credits
     */
    fastify.post('/:id/unlock', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const predictionId = request.params.id;
            const result = await (0, predictionUnlock_service_1.unlockPrediction)(userId, predictionId);
            if (!result.success) {
                return reply.status(400).send({
                    success: false,
                    error: result.error || 'UNLOCK_FAILED',
                    message: result.message,
                    newBalance: result.newBalance,
                    unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                });
            }
            return reply.send({
                success: true,
                message: result.message,
                newBalance: result.newBalance,
                unlockCost: predictionUnlock_service_1.UNLOCK_COST,
            });
        }
        catch (error) {
            fastify.log.error('Unlock prediction error:', error);
            return reply.status(500).send({
                success: false,
                error: 'UNLOCK_FAILED',
                message: error.message || 'Tahmin kilidi açılamadı',
            });
        }
    });
    /**
     * GET /api/predictions/:id/access
     * Check if user has access to a prediction
     */
    fastify.get('/:id/access', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const predictionId = request.params.id;
            const hasAccess = await (0, predictionUnlock_service_1.canAccessPrediction)(userId, predictionId);
            const creditsData = await credits_service_1.default.getUserCredits(userId);
            const balance = creditsData?.balance || 0;
            return reply.send({
                success: true,
                hasAccess,
                unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                currentBalance: balance,
                canAfford: balance >= predictionUnlock_service_1.UNLOCK_COST,
            });
        }
        catch (error) {
            fastify.log.error('Check access error:', error);
            return reply.status(500).send({
                success: false,
                error: 'CHECK_ACCESS_FAILED',
                message: error.message || 'Erişim kontrolü başarısız',
            });
        }
    });
    /**
     * GET /api/predictions/unlocked
     * Get list of prediction IDs user has unlocked
     */
    fastify.get('/unlocked', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const unlockedIds = await (0, predictionUnlock_service_1.getUserUnlockedPredictions)(userId);
            const stats = await (0, predictionUnlock_service_1.getUserUnlockStats)(userId);
            const creditsData = await credits_service_1.default.getUserCredits(userId);
            const balance = creditsData?.balance || 0;
            return reply.send({
                success: true,
                data: {
                    unlockedPredictionIds: unlockedIds,
                    totalUnlocked: stats.totalUnlocked,
                    totalCreditsSpent: stats.totalCreditsSpent,
                    currentBalance: balance,
                    unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                },
            });
        }
        catch (error) {
            fastify.log.error('Get unlocked predictions error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_UNLOCKED_FAILED',
                message: error.message || 'Açılan tahminler alınamadı',
            });
        }
    });
    /**
     * GET /api/predictions/unlock-info
     * Get unlock cost and user balance info
     */
    fastify.get('/unlock-info', { preHandler: auth_middleware_1.requireAuth }, async (request, reply) => {
        try {
            const userId = request.user.userId;
            const creditsData = await credits_service_1.default.getUserCredits(userId);
            const balance = creditsData?.balance || 0;
            return reply.send({
                success: true,
                data: {
                    unlockCost: predictionUnlock_service_1.UNLOCK_COST,
                    currentBalance: balance,
                    canAfford: balance >= predictionUnlock_service_1.UNLOCK_COST,
                    predictionsCanUnlock: Math.floor(balance / predictionUnlock_service_1.UNLOCK_COST),
                },
            });
        }
        catch (error) {
            fastify.log.error('Get unlock info error:', error);
            return reply.status(500).send({
                success: false,
                error: 'GET_INFO_FAILED',
                message: error.message || 'Bilgi alınamadı',
            });
        }
    });
}

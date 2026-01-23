"use strict";
/**
 * Prediction Unlock Service
 *
 * Handles credit-based prediction unlocking for FREE users
 * - Check if user has unlocked a prediction
 * - Unlock prediction with credits
 * - Get user's unlocked predictions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNLOCK_COST = void 0;
exports.hasUnlockedPrediction = hasUnlockedPrediction;
exports.isUserVip = isUserVip;
exports.canAccessPrediction = canAccessPrediction;
exports.unlockPrediction = unlockPrediction;
exports.getUserUnlockedPredictions = getUserUnlockedPredictions;
exports.getUserUnlockStats = getUserUnlockStats;
exports.getUnlockedPredictionIds = getUnlockedPredictionIds;
const kysely_1 = require("../database/kysely");
const credits_service_1 = __importDefault(require("./credits.service"));
const kysely_2 = require("kysely");
// ============================================================================
// CONSTANTS
// ============================================================================
exports.UNLOCK_COST = 50; // Credits required to unlock a prediction
// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================
/**
 * Check if user has unlocked a specific prediction
 */
async function hasUnlockedPrediction(userId, predictionId) {
    const unlock = await kysely_1.db
        .selectFrom('customer_prediction_unlocks')
        .select('id')
        .where('customer_user_id', '=', userId)
        .where('prediction_id', '=', predictionId)
        .executeTakeFirst();
    return !!unlock;
}
/**
 * Check if user is VIP (has active subscription)
 */
async function isUserVip(userId) {
    const user = await kysely_1.db
        .selectFrom('customer_users')
        .select('is_vip')
        .where('id', '=', userId)
        .executeTakeFirst();
    return user?.is_vip === true;
}
/**
 * Check if user can access a prediction (VIP or unlocked)
 */
async function canAccessPrediction(userId, predictionId) {
    // VIP users have full access
    const isVip = await isUserVip(userId);
    if (isVip)
        return true;
    // Check if user has unlocked this prediction
    return hasUnlockedPrediction(userId, predictionId);
}
/**
 * Unlock a prediction using credits
 */
async function unlockPrediction(userId, predictionId) {
    // Check if already unlocked
    const alreadyUnlocked = await hasUnlockedPrediction(userId, predictionId);
    if (alreadyUnlocked) {
        return {
            success: true,
            message: 'Bu tahmin zaten açık',
        };
    }
    // Check if user is VIP (shouldn't need to unlock)
    const isVip = await isUserVip(userId);
    if (isVip) {
        return {
            success: true,
            message: 'VIP kullanıcılar tüm tahminlere erişebilir',
        };
    }
    // Check balance
    const creditsData = await credits_service_1.default.getUserCredits(userId);
    const balance = creditsData?.balance || 0;
    if (balance < exports.UNLOCK_COST) {
        return {
            success: false,
            message: `Yetersiz kredi. ${exports.UNLOCK_COST} kredi gerekli, mevcut: ${balance}`,
            error: 'INSUFFICIENT_CREDITS',
            newBalance: balance,
        };
    }
    try {
        // Spend credits
        const spendResult = await credits_service_1.default.spendCredits({
            userId,
            amount: exports.UNLOCK_COST,
            transactionType: 'prediction_unlock',
            referenceId: predictionId,
            description: `Tahmin kilidi açma: ${predictionId}`,
        });
        if (!spendResult.success) {
            return {
                success: false,
                message: 'Kredi harcama işlemi başarısız',
                error: 'SPEND_FAILED',
            };
        }
        // Record the unlock
        await kysely_1.db
            .insertInto('customer_prediction_unlocks')
            .values({
            customer_user_id: userId,
            prediction_id: predictionId,
            credits_spent: exports.UNLOCK_COST,
            unlocked_at: (0, kysely_2.sql) `NOW()`,
        })
            .execute();
        return {
            success: true,
            message: 'Tahmin başarıyla açıldı!',
            newBalance: spendResult.newBalance,
        };
    }
    catch (error) {
        // Handle duplicate key error (race condition)
        if (error.code === '23505') {
            return {
                success: true,
                message: 'Bu tahmin zaten açık',
            };
        }
        throw error;
    }
}
/**
 * Get all predictions unlocked by a user
 */
async function getUserUnlockedPredictions(userId) {
    const unlocks = await kysely_1.db
        .selectFrom('customer_prediction_unlocks')
        .select('prediction_id')
        .where('customer_user_id', '=', userId)
        .execute();
    return unlocks.map(u => u.prediction_id);
}
/**
 * Get unlock statistics for a user
 */
async function getUserUnlockStats(userId) {
    const stats = await kysely_1.db
        .selectFrom('customer_prediction_unlocks')
        .select([
        (0, kysely_2.sql) `COUNT(*)`.as('total_unlocked'),
        (0, kysely_2.sql) `COALESCE(SUM(credits_spent), 0)`.as('total_credits_spent'),
    ])
        .where('customer_user_id', '=', userId)
        .executeTakeFirst();
    return {
        totalUnlocked: Number(stats?.total_unlocked || 0),
        totalCreditsSpent: Number(stats?.total_credits_spent || 0),
    };
}
/**
 * Bulk check which predictions are unlocked for a user
 */
async function getUnlockedPredictionIds(userId, predictionIds) {
    if (predictionIds.length === 0)
        return new Set();
    // Check if VIP
    const isVip = await isUserVip(userId);
    if (isVip) {
        // VIP has access to all
        return new Set(predictionIds);
    }
    const unlocks = await kysely_1.db
        .selectFrom('customer_prediction_unlocks')
        .select('prediction_id')
        .where('customer_user_id', '=', userId)
        .where('prediction_id', 'in', predictionIds)
        .execute();
    return new Set(unlocks.map(u => u.prediction_id));
}

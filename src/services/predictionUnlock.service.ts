/**
 * Prediction Unlock Service
 * 
 * Handles credit-based prediction unlocking for FREE users
 * - Check if user has unlocked a prediction
 * - Unlock prediction with credits
 * - Get user's unlocked predictions
 */

import { db } from '../database/kysely';
import creditsService from './credits.service';
import { sql } from 'kysely';

// ============================================================================
// CONSTANTS
// ============================================================================

export const UNLOCK_COST = 50; // Credits required to unlock a prediction

// ============================================================================
// TYPES
// ============================================================================

export interface PredictionUnlock {
    id: string;
    customer_user_id: string;
    prediction_id: string;
    credits_spent: number;
    unlocked_at: Date;
}

export interface UnlockResult {
    success: boolean;
    message: string;
    newBalance?: number;
    error?: string;
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Check if user has unlocked a specific prediction
 */
export async function hasUnlockedPrediction(
    userId: string,
    predictionId: string
): Promise<boolean> {
    const unlock = await db
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
export async function isUserVip(userId: string): Promise<boolean> {
    const user = await db
        .selectFrom('customer_users')
        .select('is_vip')
        .where('id', '=', userId)
        .executeTakeFirst();

    return user?.is_vip === true;
}

/**
 * Check if user can access a prediction (VIP or unlocked)
 */
export async function canAccessPrediction(
    userId: string,
    predictionId: string
): Promise<boolean> {
    // VIP users have full access
    const isVip = await isUserVip(userId);
    if (isVip) return true;

    // Check if user has unlocked this prediction
    return hasUnlockedPrediction(userId, predictionId);
}

/**
 * Unlock a prediction using credits
 */
export async function unlockPrediction(
    userId: string,
    predictionId: string
): Promise<UnlockResult> {
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
    const creditsData = await creditsService.getUserCredits(userId);
    const balance = creditsData?.balance || 0;
    if (balance < UNLOCK_COST) {
        return {
            success: false,
            message: `Yetersiz kredi. ${UNLOCK_COST} kredi gerekli, mevcut: ${balance}`,
            error: 'INSUFFICIENT_CREDITS',
            newBalance: balance,
        };
    }

    try {
        // Spend credits
        const spendResult = await creditsService.spendCredits({
            userId,
            amount: UNLOCK_COST,
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
        await db
            .insertInto('customer_prediction_unlocks')
            .values({
                customer_user_id: userId,
                prediction_id: predictionId,
                credits_spent: UNLOCK_COST,
                unlocked_at: sql`NOW()`,
            })
            .execute();

        return {
            success: true,
            message: 'Tahmin başarıyla açıldı!',
            newBalance: spendResult.newBalance,
        };
    } catch (error: any) {
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
export async function getUserUnlockedPredictions(
    userId: string
): Promise<string[]> {
    const unlocks = await db
        .selectFrom('customer_prediction_unlocks')
        .select('prediction_id')
        .where('customer_user_id', '=', userId)
        .execute();

    return unlocks.map(u => u.prediction_id);
}

/**
 * Get unlock statistics for a user
 */
export async function getUserUnlockStats(userId: string): Promise<{
    totalUnlocked: number;
    totalCreditsSpent: number;
}> {
    const stats = await db
        .selectFrom('customer_prediction_unlocks')
        .select([
            sql<number>`COUNT(*)`.as('total_unlocked'),
            sql<number>`COALESCE(SUM(credits_spent), 0)`.as('total_credits_spent'),
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
export async function getUnlockedPredictionIds(
    userId: string,
    predictionIds: string[]
): Promise<Set<string>> {
    if (predictionIds.length === 0) return new Set();

    // Check if VIP
    const isVip = await isUserVip(userId);
    if (isVip) {
        // VIP has access to all
        return new Set(predictionIds);
    }

    const unlocks = await db
        .selectFrom('customer_prediction_unlocks')
        .select('prediction_id')
        .where('customer_user_id', '=', userId)
        .where('prediction_id', 'in', predictionIds)
        .execute();

    return new Set(unlocks.map(u => u.prediction_id));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DAILY_CREDITS_FROM_ADS = exports.DAILY_AD_LIMIT = exports.CREDIT_COSTS = exports.CREDIT_REWARDS = exports.CreditTransactionType = void 0;
exports.grantCredits = grantCredits;
exports.spendCredits = spendCredits;
exports.getUserCredits = getUserCredits;
exports.getCreditTransactions = getCreditTransactions;
exports.processAdReward = processAdReward;
exports.purchaseVIPPrediction = purchaseVIPPrediction;
exports.refundCredits = refundCredits;
exports.getDailyCreditsStats = getDailyCreditsStats;
const kysely_1 = require("../database/kysely");
const kysely_2 = require("kysely");
const logger_1 = require("../utils/logger");
/**
 * Credits Service
 * Handles virtual currency balance management and transactions
 *
 * 1 Credit = 1 TL equivalent value
 * Credits can be earned via:
 * - Watching rewarded ads
 * - Badge unlocks
 * - Referral bonuses
 * - Level-up rewards
 * - Admin grants
 * - Promotional campaigns
 *
 * Credits can be spent on:
 * - VIP prediction purchases
 * - Premium features (future)
 */
// Credit transaction types
var CreditTransactionType;
(function (CreditTransactionType) {
    CreditTransactionType["AD_REWARD"] = "ad_reward";
    CreditTransactionType["PURCHASE"] = "purchase";
    CreditTransactionType["REFERRAL_BONUS"] = "referral_bonus";
    CreditTransactionType["BADGE_REWARD"] = "badge_reward";
    CreditTransactionType["PREDICTION_PURCHASE"] = "prediction_purchase";
    CreditTransactionType["DAILY_REWARD"] = "daily_reward";
    CreditTransactionType["ADMIN_GRANT"] = "admin_grant";
    CreditTransactionType["ADMIN_DEDUCT"] = "admin_deduct";
    CreditTransactionType["REFUND"] = "refund";
    CreditTransactionType["SUBSCRIPTION_BONUS"] = "subscription_bonus";
    CreditTransactionType["PROMOTIONAL"] = "promotional";
})(CreditTransactionType || (exports.CreditTransactionType = CreditTransactionType = {}));
// Credit reward amounts by activity
exports.CREDIT_REWARDS = {
    ad_reward: 5, // Per rewarded video ad
    referral_signup: 10,
    referral_first_login: 50,
    referral_subscription: 200,
    badge_common: 5,
    badge_rare: 25,
    badge_epic: 50,
    badge_legendary: 100,
    daily_reward_day_1: 10,
    daily_reward_day_2: 15,
    daily_reward_day_3: 20,
    daily_reward_day_4: 25,
    daily_reward_day_5: 30,
    daily_reward_day_6: 40,
    daily_reward_day_7: 100, // Jackpot day
};
// Credit costs for purchases
exports.CREDIT_COSTS = {
    vip_prediction: 10, // Cost to unlock VIP prediction
};
// Fraud prevention limits
exports.DAILY_AD_LIMIT = 10; // Max 10 ads per day per user
exports.MAX_DAILY_CREDITS_FROM_ADS = exports.CREDIT_REWARDS.ad_reward * exports.DAILY_AD_LIMIT; // 50 credits/day
/**
 * Grant credits to user (with transaction logging)
 */
async function grantCredits(params) {
    const { userId, amount, transactionType, description, referenceId, referenceType, metadata = {}, } = params;
    if (amount <= 0) {
        throw new Error('Credit amount must be positive');
    }
    return kysely_1.db.transaction().execute(async (trx) => {
        // 1. Get current balance
        const currentCredits = await trx
            .selectFrom('customer_credits')
            .select(['balance', 'lifetime_earned'])
            .where('customer_user_id', '=', userId)
            .executeTakeFirst();
        if (!currentCredits) {
            throw new Error('User credits record not found');
        }
        const oldBalance = currentCredits.balance;
        const newBalance = oldBalance + amount;
        // 2. Update balance
        await trx
            .updateTable('customer_credits')
            .set({
            balance: newBalance,
            lifetime_earned: currentCredits.lifetime_earned + amount,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .where('customer_user_id', '=', userId)
            .execute();
        // 3. Log transaction
        const transaction = await trx
            .insertInto('customer_credit_transactions')
            .values({
            customer_user_id: userId,
            amount,
            transaction_type: transactionType,
            description: description || null,
            reference_id: referenceId || null,
            reference_type: referenceType || null,
            balance_before: oldBalance,
            balance_after: newBalance,
            metadata: JSON.stringify(metadata),
            created_at: (0, kysely_2.sql) `NOW()`,
        })
            .returning('id')
            .executeTakeFirstOrThrow();
        logger_1.logger.info(`Granted ${amount} credits to user ${userId}`, {
            type: transactionType,
            oldBalance,
            newBalance,
        });
        return {
            success: true,
            oldBalance,
            newBalance,
            transactionId: transaction.id,
        };
    });
}
/**
 * Spend credits (with balance validation)
 */
async function spendCredits(params) {
    const { userId, amount, transactionType, description, referenceId, referenceType, metadata = {}, } = params;
    if (amount <= 0) {
        throw new Error('Credit amount must be positive');
    }
    return kysely_1.db.transaction().execute(async (trx) => {
        // 1. Get current balance
        const currentCredits = await trx
            .selectFrom('customer_credits')
            .select(['balance', 'lifetime_spent'])
            .where('customer_user_id', '=', userId)
            .executeTakeFirst();
        if (!currentCredits) {
            throw new Error('User credits record not found');
        }
        const oldBalance = currentCredits.balance;
        // 2. Validate sufficient balance
        if (oldBalance < amount) {
            throw new Error(`Insufficient credits. Required: ${amount}, Available: ${oldBalance}`);
        }
        const newBalance = oldBalance - amount;
        // 3. Update balance
        await trx
            .updateTable('customer_credits')
            .set({
            balance: newBalance,
            lifetime_spent: currentCredits.lifetime_spent + amount,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .where('customer_user_id', '=', userId)
            .execute();
        // 4. Log transaction (negative amount for spending)
        const transaction = await trx
            .insertInto('customer_credit_transactions')
            .values({
            customer_user_id: userId,
            amount: -amount, // Negative for spending
            transaction_type: transactionType,
            description: description || null,
            reference_id: referenceId || null,
            reference_type: referenceType || null,
            balance_before: oldBalance,
            balance_after: newBalance,
            metadata: JSON.stringify(metadata),
            created_at: (0, kysely_2.sql) `NOW()`,
        })
            .returning('id')
            .executeTakeFirstOrThrow();
        logger_1.logger.info(`User ${userId} spent ${amount} credits`, {
            type: transactionType,
            oldBalance,
            newBalance,
        });
        return {
            success: true,
            oldBalance,
            newBalance,
            transactionId: transaction.id,
        };
    });
}
/**
 * Get user credits balance
 */
async function getUserCredits(userId) {
    const creditsData = await kysely_1.db
        .selectFrom('customer_credits')
        .select(['balance', 'lifetime_earned', 'lifetime_spent'])
        .where('customer_user_id', '=', userId)
        .executeTakeFirst();
    if (!creditsData) {
        return null;
    }
    return {
        balance: creditsData.balance,
        lifetimeEarned: creditsData.lifetime_earned,
        lifetimeSpent: creditsData.lifetime_spent,
    };
}
/**
 * Get credit transaction history
 */
async function getCreditTransactions(userId, limit = 50, offset = 0) {
    const transactions = await kysely_1.db
        .selectFrom('customer_credit_transactions')
        .select([
        'id',
        'amount',
        'transaction_type',
        'description',
        'reference_id',
        'reference_type',
        'balance_before',
        'balance_after',
        'metadata',
        'created_at',
    ])
        .where('customer_user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();
    return transactions;
}
/**
 * Process ad reward (with fraud prevention)
 */
async function processAdReward(userId, adNetwork, adUnitId, adType, deviceId, ipAddress, userAgent) {
    // 1. Check daily ad limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAds = await kysely_1.db
        .selectFrom('customer_ad_views')
        .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
        .where('customer_user_id', '=', userId)
        .where('completed_at', '>=', today)
        .where('reward_granted', '=', true)
        .executeTakeFirst();
    const adsWatchedToday = Number(todayAds?.count || 0);
    if (adsWatchedToday >= exports.DAILY_AD_LIMIT) {
        return {
            success: false,
            credits: 0,
            message: `Günlük reklam limiti aşıldı (${exports.DAILY_AD_LIMIT}/${exports.DAILY_AD_LIMIT})`,
        };
    }
    // 2. Log ad view
    await kysely_1.db
        .insertInto('customer_ad_views')
        .values({
        customer_user_id: userId,
        ad_network: adNetwork,
        ad_unit_id: adUnitId,
        ad_type: adType,
        reward_amount: exports.CREDIT_REWARDS.ad_reward,
        reward_granted: true,
        device_id: deviceId,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        completed_at: (0, kysely_2.sql) `NOW()`,
        metadata: JSON.stringify({ daily_count: adsWatchedToday + 1 }),
    })
        .execute();
    // 3. Grant credits
    await grantCredits({
        userId,
        amount: exports.CREDIT_REWARDS.ad_reward,
        transactionType: CreditTransactionType.AD_REWARD,
        description: `Reklam izleme ödülü (${adsWatchedToday + 1}/${exports.DAILY_AD_LIMIT})`,
        referenceType: 'ad_view',
        metadata: {
            ad_network: adNetwork,
            ad_type: adType,
            daily_count: adsWatchedToday + 1,
        },
    });
    return {
        success: true,
        credits: exports.CREDIT_REWARDS.ad_reward,
        message: `${exports.CREDIT_REWARDS.ad_reward} kredi kazandın! (${adsWatchedToday + 1}/${exports.DAILY_AD_LIMIT})`,
    };
}
/**
 * Purchase VIP prediction with credits
 */
async function purchaseVIPPrediction(userId, predictionId) {
    const cost = exports.CREDIT_COSTS.vip_prediction;
    // Check if already purchased
    const existingPurchase = await kysely_1.db
        .selectFrom('ts_prediction_mapped')
        .select('id')
        .where('id', '=', predictionId)
        .where('purchased_by_user_id', '=', userId)
        .executeTakeFirst();
    if (existingPurchase) {
        throw new Error('Bu tahmin zaten satın alındı');
    }
    // Spend credits
    await spendCredits({
        userId,
        amount: cost,
        transactionType: CreditTransactionType.PREDICTION_PURCHASE,
        description: `VIP tahmin satın alındı`,
        referenceId: predictionId,
        referenceType: 'prediction',
        metadata: { prediction_id: predictionId },
    });
    // Mark prediction as purchased
    await kysely_1.db
        .updateTable('ts_prediction_mapped')
        .set({
        credit_cost: cost,
        purchased_by_user_id: userId,
        purchased_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', predictionId)
        .execute();
    logger_1.logger.info(`User ${userId} purchased VIP prediction ${predictionId} for ${cost} credits`);
    return {
        success: true,
        creditsSpent: cost,
    };
}
/**
 * Refund credits (e.g., for cancelled purchase)
 */
async function refundCredits(userId, amount, reason, referenceId) {
    return grantCredits({
        userId,
        amount,
        transactionType: CreditTransactionType.REFUND,
        description: `İade: ${reason}`,
        referenceId,
        referenceType: 'refund',
        metadata: { reason },
    });
}
/**
 * Get total credits earned/spent today
 */
async function getDailyCreditsStats(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stats = await kysely_1.db
        .selectFrom('customer_credit_transactions')
        .select([
        (0, kysely_2.sql) `COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`.as('earned_today'),
        (0, kysely_2.sql) `COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`.as('spent_today'),
    ])
        .where('customer_user_id', '=', userId)
        .where('created_at', '>=', today)
        .executeTakeFirst();
    // Get ads watched today
    const adsToday = await kysely_1.db
        .selectFrom('customer_ad_views')
        .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
        .where('customer_user_id', '=', userId)
        .where('completed_at', '>=', today)
        .where('reward_granted', '=', true)
        .executeTakeFirst();
    return {
        earnedToday: Number(stats?.earned_today || 0),
        spentToday: Number(stats?.spent_today || 0),
        adsWatchedToday: Number(adsToday?.count || 0),
        adsRemainingToday: Math.max(0, exports.DAILY_AD_LIMIT - Number(adsToday?.count || 0)),
    };
}
exports.default = {
    grantCredits,
    spendCredits,
    getUserCredits,
    getCreditTransactions,
    processAdReward,
    purchaseVIPPrediction,
    refundCredits,
    getDailyCreditsStats,
};

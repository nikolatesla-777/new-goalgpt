import { db } from '../database/kysely';
import { sql } from 'kysely';
import { logger } from '../utils/logger';

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
export enum CreditTransactionType {
  AD_REWARD = 'ad_reward',
  PURCHASE = 'purchase',
  REFERRAL_BONUS = 'referral_bonus',
  BADGE_REWARD = 'badge_reward',
  PREDICTION_PURCHASE = 'prediction_purchase',
  DAILY_REWARD = 'daily_reward',
  ADMIN_GRANT = 'admin_grant',
  ADMIN_DEDUCT = 'admin_deduct',
  REFUND = 'refund',
  SUBSCRIPTION_BONUS = 'subscription_bonus',
  PROMOTIONAL = 'promotional',
}

// Credit reward amounts by activity
export const CREDIT_REWARDS: Record<string, number> = {
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
export const CREDIT_COSTS: Record<string, number> = {
  vip_prediction: 10, // Cost to unlock VIP prediction
};

// Fraud prevention limits
export const DAILY_AD_LIMIT = 10; // Max 10 ads per day per user
export const MAX_DAILY_CREDITS_FROM_ADS = CREDIT_REWARDS.ad_reward * DAILY_AD_LIMIT; // 50 credits/day

interface GrantCreditsParams {
  userId: string;
  amount: number;
  transactionType: CreditTransactionType | string;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, any>;
}

interface SpendCreditsParams {
  userId: string;
  amount: number;
  transactionType: CreditTransactionType | string;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, any>;
}

interface CreditResult {
  success: boolean;
  oldBalance: number;
  newBalance: number;
  transactionId: string;
}

/**
 * Grant credits to user (with transaction logging)
 */
export async function grantCredits(params: GrantCreditsParams): Promise<CreditResult> {
  const {
    userId,
    amount,
    transactionType,
    description,
    referenceId,
    referenceType,
    metadata = {},
  } = params;

  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  return db.transaction().execute(async (trx) => {
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
        updated_at: sql`NOW()`,
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
        created_at: sql`NOW()`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    logger.info(`Granted ${amount} credits to user ${userId}`, {
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
export async function spendCredits(params: SpendCreditsParams): Promise<CreditResult> {
  const {
    userId,
    amount,
    transactionType,
    description,
    referenceId,
    referenceType,
    metadata = {},
  } = params;

  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  return db.transaction().execute(async (trx) => {
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
      throw new Error(
        `Insufficient credits. Required: ${amount}, Available: ${oldBalance}`
      );
    }

    const newBalance = oldBalance - amount;

    // 3. Update balance
    await trx
      .updateTable('customer_credits')
      .set({
        balance: newBalance,
        lifetime_spent: currentCredits.lifetime_spent + amount,
        updated_at: sql`NOW()`,
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
        created_at: sql`NOW()`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    logger.info(`User ${userId} spent ${amount} credits`, {
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
export async function getUserCredits(userId: string) {
  const creditsData = await db
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
export async function getCreditTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  const transactions = await db
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
export async function processAdReward(
  userId: string,
  adNetwork: string,
  adUnitId: string,
  adType: 'rewarded_video' | 'rewarded_interstitial',
  deviceId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; credits: number; message: string }> {
  // 1. Check daily ad limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayAds = await db
    .selectFrom('customer_ad_views')
    .select(sql<number>`COUNT(*)`.as('count'))
    .where('customer_user_id', '=', userId)
    .where('completed_at', '>=', today)
    .where('reward_granted', '=', true)
    .executeTakeFirst();

  const adsWatchedToday = Number(todayAds?.count || 0);

  if (adsWatchedToday >= DAILY_AD_LIMIT) {
    return {
      success: false,
      credits: 0,
      message: `Günlük reklam limiti aşıldı (${DAILY_AD_LIMIT}/${DAILY_AD_LIMIT})`,
    };
  }

  // 2. Log ad view
  await db
    .insertInto('customer_ad_views')
    .values({
      customer_user_id: userId,
      ad_network: adNetwork,
      ad_unit_id: adUnitId,
      ad_type: adType,
      reward_amount: CREDIT_REWARDS.ad_reward,
      reward_granted: true,
      device_id: deviceId,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      completed_at: sql`NOW()`,
      metadata: JSON.stringify({ daily_count: adsWatchedToday + 1 }),
    })
    .execute();

  // 3. Grant credits
  await grantCredits({
    userId,
    amount: CREDIT_REWARDS.ad_reward,
    transactionType: CreditTransactionType.AD_REWARD,
    description: `Reklam izleme ödülü (${adsWatchedToday + 1}/${DAILY_AD_LIMIT})`,
    referenceType: 'ad_view',
    metadata: {
      ad_network: adNetwork,
      ad_type: adType,
      daily_count: adsWatchedToday + 1,
    },
  });

  return {
    success: true,
    credits: CREDIT_REWARDS.ad_reward,
    message: `${CREDIT_REWARDS.ad_reward} kredi kazandın! (${adsWatchedToday + 1}/${DAILY_AD_LIMIT})`,
  };
}

/**
 * Purchase VIP prediction with credits
 */
export async function purchaseVIPPrediction(
  userId: string,
  predictionId: string
): Promise<{ success: boolean; creditsSpent: number }> {
  const cost = CREDIT_COSTS.vip_prediction;

  // Check if already purchased
  const existingPurchase = await db
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
  await db
    .updateTable('ts_prediction_mapped')
    .set({
      credit_cost: cost,
      purchased_by_user_id: userId,
      purchased_at: sql`NOW()`,
    })
    .where('id', '=', predictionId)
    .execute();

  logger.info(`User ${userId} purchased VIP prediction ${predictionId} for ${cost} credits`);

  return {
    success: true,
    creditsSpent: cost,
  };
}

/**
 * Refund credits (e.g., for cancelled purchase)
 */
export async function refundCredits(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<CreditResult> {
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
export async function getDailyCreditsStats(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await db
    .selectFrom('customer_credit_transactions')
    .select([
      sql<number>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`.as('earned_today'),
      sql<number>`COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)`.as('spent_today'),
    ])
    .where('customer_user_id', '=', userId)
    .where('created_at', '>=', today)
    .executeTakeFirst();

  // Get ads watched today
  const adsToday = await db
    .selectFrom('customer_ad_views')
    .select(sql<number>`COUNT(*)`.as('count'))
    .where('customer_user_id', '=', userId)
    .where('completed_at', '>=', today)
    .where('reward_granted', '=', true)
    .executeTakeFirst();

  return {
    earnedToday: Number(stats?.earned_today || 0),
    spentToday: Number(stats?.spent_today || 0),
    adsWatchedToday: Number(adsToday?.count || 0),
    adsRemainingToday: Math.max(0, DAILY_AD_LIMIT - Number(adsToday?.count || 0)),
  };
}

export default {
  grantCredits,
  spendCredits,
  getUserCredits,
  getCreditTransactions,
  processAdReward,
  purchaseVIPPrediction,
  refundCredits,
  getDailyCreditsStats,
};

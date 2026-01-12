import { db } from '../database/kysely';
import { sql } from 'kysely';
import { logger } from '../utils/logger';

/**
 * XP Leveling Service
 * Handles XP grants, level calculations, and progression
 */

// XP Level definitions
export type XPLevel = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'vip_elite';

// XP requirements for each level
export const XP_LEVELS: Record<XPLevel, { min: number; max: number; name_tr: string; name_en: string }> = {
  bronze: { min: 0, max: 499, name_tr: 'Bronz', name_en: 'Bronze' },
  silver: { min: 500, max: 1999, name_tr: 'Gümüş', name_en: 'Silver' },
  gold: { min: 2000, max: 4999, name_tr: 'Altın', name_en: 'Gold' },
  platinum: { min: 5000, max: 9999, name_tr: 'Platin', name_en: 'Platinum' },
  diamond: { min: 10000, max: 24999, name_tr: 'Elmas', name_en: 'Diamond' },
  vip_elite: { min: 25000, max: Infinity, name_tr: 'VIP Elite', name_en: 'VIP Elite' },
};

// XP transaction types
export enum XPTransactionType {
  DAILY_LOGIN = 'daily_login',
  PREDICTION_CORRECT = 'prediction_correct',
  REFERRAL_SIGNUP = 'referral_signup',
  BADGE_UNLOCK = 'badge_unlock',
  MATCH_COMMENT = 'match_comment',
  COMMENT_LIKE = 'comment_like',
  SUBSCRIPTION_PURCHASE = 'subscription_purchase',
  AD_WATCH = 'ad_watch',
  ADMIN_GRANT = 'admin_grant',
  ADMIN_DEDUCT = 'admin_deduct',
  ACHIEVEMENT_UNLOCK = 'achievement_unlock',
  STREAK_BONUS = 'streak_bonus',
}

// XP reward amounts by activity
export const XP_REWARDS: Record<string, number> = {
  daily_login: 10,
  prediction_correct: 25,
  referral_signup: 50,
  badge_unlock: 100, // Will vary by badge
  match_comment: 5,
  comment_like: 2,
  subscription_purchase: 500,
  ad_watch: 5,
  streak_bonus_7: 100,
  streak_bonus_30: 500,
};

interface GrantXPParams {
  userId: string;
  amount: number;
  transactionType: XPTransactionType;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, any>;
}

interface XPResult {
  success: boolean;
  oldXP: number;
  newXP: number;
  oldLevel: XPLevel;
  newLevel: XPLevel;
  leveledUp: boolean;
  levelUpRewards?: {
    credits?: number;
    badge?: string;
  };
}

/**
 * Calculate level based on XP points
 */
export function calculateLevel(xpPoints: number): XPLevel {
  if (xpPoints >= XP_LEVELS.vip_elite.min) return 'vip_elite';
  if (xpPoints >= XP_LEVELS.diamond.min) return 'diamond';
  if (xpPoints >= XP_LEVELS.platinum.min) return 'platinum';
  if (xpPoints >= XP_LEVELS.gold.min) return 'gold';
  if (xpPoints >= XP_LEVELS.silver.min) return 'silver';
  return 'bronze';
}

/**
 * Calculate level progress percentage
 */
export function calculateLevelProgress(xpPoints: number, level: XPLevel): number {
  const levelConfig = XP_LEVELS[level];

  // VIP Elite has no upper limit
  if (level === 'vip_elite') {
    return 100;
  }

  const rangeSize = levelConfig.max - levelConfig.min + 1;
  const pointsInLevel = xpPoints - levelConfig.min;
  const progress = (pointsInLevel / rangeSize) * 100;

  return Math.min(100, Math.max(0, progress));
}

/**
 * Get next level XP requirement
 */
export function getNextLevelXP(currentLevel: XPLevel): number | null {
  if (currentLevel === 'vip_elite') return null; // Max level

  const levels: XPLevel[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'vip_elite'];
  const currentIndex = levels.indexOf(currentLevel);
  const nextLevel = levels[currentIndex + 1];

  return XP_LEVELS[nextLevel].min;
}

/**
 * Grant XP to user (with transaction logging and level-up detection)
 */
export async function grantXP(params: GrantXPParams): Promise<XPResult> {
  const {
    userId,
    amount,
    transactionType,
    description,
    referenceId,
    referenceType,
    metadata = {},
  } = params;

  if (amount === 0) {
    throw new Error('XP amount cannot be zero');
  }

  return db.transaction().execute(async (trx) => {
    // 1. Get current XP
    const currentXP = await trx
      .selectFrom('customer_xp')
      .select(['xp_points', 'level', 'total_earned'])
      .where('customer_user_id', '=', userId)
      .executeTakeFirst();

    if (!currentXP) {
      throw new Error('User XP record not found');
    }

    const oldXP = currentXP.xp_points;
    const oldLevel = currentXP.level;
    const newXP = Math.max(0, oldXP + amount); // Can't go below 0
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel !== oldLevel;

    // 2. Update XP
    const levelProgress = calculateLevelProgress(newXP, newLevel);
    const nextLevelXP = getNextLevelXP(newLevel);

    await trx
      .updateTable('customer_xp')
      .set({
        xp_points: newXP,
        level: newLevel,
        level_progress: levelProgress,
        total_earned: amount > 0 ? currentXP.total_earned + amount : currentXP.total_earned,
        next_level_xp: nextLevelXP,
        updated_at: sql`NOW()`,
      })
      .where('customer_user_id', '=', userId)
      .execute();

    // 3. Log transaction
    await trx
      .insertInto('customer_xp_transactions')
      .values({
        customer_user_id: userId,
        xp_amount: amount,
        transaction_type: transactionType,
        description: description || null,
        reference_id: referenceId || null,
        reference_type: referenceType || null,
        metadata: JSON.stringify(metadata),
        created_at: sql`NOW()`,
      })
      .execute();

    // 4. Handle level-up rewards
    let levelUpRewards: { credits?: number; badge?: string } | undefined;

    if (leveledUp && amount > 0) {
      logger.info(`User ${userId} leveled up: ${oldLevel} → ${newLevel}`);

      // Grant level-up credits
      const levelUpCredits = getLevelUpCredits(newLevel);
      if (levelUpCredits > 0) {
        // Import credits service to avoid circular dependency
        const { grantCredits } = await import('./credits.service');
        await grantCredits({
          userId,
          amount: levelUpCredits,
          transactionType: 'promotional',
          description: `${newLevel.toUpperCase()} seviyesine ulaştın! 🎉`,
          metadata: { level_up: true, from: oldLevel, to: newLevel },
        });

        levelUpRewards = { credits: levelUpCredits };
      }

      // Increment achievements count
      await trx
        .updateTable('customer_xp')
        .set({
          achievements_count: sql`achievements_count + 1`,
        })
        .where('customer_user_id', '=', userId)
        .execute();
    }

    return {
      success: true,
      oldXP,
      newXP,
      oldLevel,
      newLevel,
      leveledUp,
      levelUpRewards,
    };
  });
}

/**
 * Get level-up credit rewards
 */
function getLevelUpCredits(level: XPLevel): number {
  const rewards: Record<XPLevel, number> = {
    bronze: 0,
    silver: 25,
    gold: 50,
    platinum: 100,
    diamond: 250,
    vip_elite: 500,
  };
  return rewards[level];
}

/**
 * Update daily login streak
 */
export async function updateLoginStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  xpGranted: number;
}> {
  return db.transaction().execute(async (trx) => {
    const xpData = await trx
      .selectFrom('customer_xp')
      .select(['current_streak_days', 'longest_streak_days', 'last_activity_date'])
      .where('customer_user_id', '=', userId)
      .executeTakeFirst();

    if (!xpData) {
      throw new Error('User XP record not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActivity = xpData.last_activity_date
      ? new Date(xpData.last_activity_date)
      : null;

    let currentStreak = xpData.current_streak_days;
    let xpGranted = 0;

    // Check if already logged in today
    if (lastActivity) {
      const lastActivityDay = new Date(
        lastActivity.getFullYear(),
        lastActivity.getMonth(),
        lastActivity.getDate()
      );

      if (lastActivityDay.getTime() === today.getTime()) {
        // Already logged in today
        return {
          currentStreak,
          longestStreak: xpData.longest_streak_days,
          xpGranted: 0,
        };
      }

      // Check if streak continues (yesterday)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastActivityDay.getTime() === yesterday.getTime()) {
        // Streak continues
        currentStreak += 1;
      } else {
        // Streak broken
        currentStreak = 1;
      }
    } else {
      // First login ever
      currentStreak = 1;
    }

    const longestStreak = Math.max(currentStreak, xpData.longest_streak_days);

    // Update streak
    await trx
      .updateTable('customer_xp')
      .set({
        current_streak_days: currentStreak,
        longest_streak_days: longestStreak,
        last_activity_date: today,
        updated_at: sql`NOW()`,
      })
      .where('customer_user_id', '=', userId)
      .execute();

    // Grant daily login XP
    const dailyXP = XP_REWARDS.daily_login;
    await grantXP({
      userId,
      amount: dailyXP,
      transactionType: XPTransactionType.DAILY_LOGIN,
      description: `Günlük giriş bonusu (${currentStreak} gün streak)`,
      metadata: { streak: currentStreak },
    });
    xpGranted += dailyXP;

    // Grant streak bonus milestones
    if (currentStreak === 7) {
      await grantXP({
        userId,
        amount: XP_REWARDS.streak_bonus_7,
        transactionType: XPTransactionType.STREAK_BONUS,
        description: '7 gün streak bonusu! 🔥',
        metadata: { streak: 7 },
      });
      xpGranted += XP_REWARDS.streak_bonus_7;
    } else if (currentStreak === 30) {
      await grantXP({
        userId,
        amount: XP_REWARDS.streak_bonus_30,
        transactionType: XPTransactionType.STREAK_BONUS,
        description: '30 gün streak bonusu! 🔥🔥🔥',
        metadata: { streak: 30 },
      });
      xpGranted += XP_REWARDS.streak_bonus_30;
    }

    return {
      currentStreak,
      longestStreak,
      xpGranted,
    };
  });
}

/**
 * Get user XP details
 */
export async function getUserXP(userId: string) {
  const xpData = await db
    .selectFrom('customer_xp')
    .select([
      'xp_points',
      'level',
      'level_progress',
      'total_earned',
      'current_streak_days',
      'longest_streak_days',
      'last_activity_date',
      'next_level_xp',
      'achievements_count',
    ])
    .where('customer_user_id', '=', userId)
    .executeTakeFirst();

  if (!xpData) {
    return null;
  }

  return {
    xpPoints: xpData.xp_points,
    level: xpData.level,
    levelProgress: xpData.level_progress,
    totalEarned: xpData.total_earned,
    currentStreak: xpData.current_streak_days,
    longestStreak: xpData.longest_streak_days,
    lastActivityDate: xpData.last_activity_date,
    nextLevelXP: xpData.next_level_xp,
    achievementsCount: xpData.achievements_count,
    levelName: XP_LEVELS[xpData.level].name_tr,
  };
}

/**
 * Get XP transaction history
 */
export async function getXPTransactions(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  const transactions = await db
    .selectFrom('customer_xp_transactions')
    .select([
      'id',
      'xp_amount',
      'transaction_type',
      'description',
      'reference_id',
      'reference_type',
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
 * Get XP leaderboard
 */
export async function getXPLeaderboard(limit: number = 100) {
  const leaderboard = await db
    .selectFrom('customer_xp as xp')
    .innerJoin('customer_users as cu', 'cu.id', 'xp.customer_user_id')
    .select([
      'cu.id',
      'cu.name',
      'cu.username',
      'xp.xp_points',
      'xp.level',
      'xp.current_streak_days',
    ])
    .where('cu.deleted_at', 'is', null)
    .orderBy('xp.xp_points', 'desc')
    .limit(limit)
    .execute();

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    userId: entry.id,
    name: entry.name,
    username: entry.username,
    xpPoints: entry.xp_points,
    level: entry.level,
    streakDays: entry.current_streak_days,
  }));
}

export default {
  grantXP,
  getUserXP,
  getXPTransactions,
  updateLoginStreak,
  getXPLeaderboard,
  calculateLevel,
  calculateLevelProgress,
  getNextLevelXP,
};

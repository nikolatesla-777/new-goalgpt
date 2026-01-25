/**
 * Daily Rewards Service - Daily Gift Wheel Management
 *
 * 7-Day Daily Reward Cycle:
 * - Day 1: 10 credits + 10 XP
 * - Day 2: 15 credits + 15 XP
 * - Day 3: 20 credits + 20 XP
 * - Day 4: 25 credits + 25 XP
 * - Day 5: 30 credits + 30 XP
 * - Day 6: 40 credits + 40 XP
 * - Day 7: 100 credits + 50 XP (Jackpot!)
 *
 * Claim once per day, resets at midnight UTC
 */

import { db } from '../database/kysely';
import { sql } from 'kysely';
import { grantXP, XPTransactionType } from './xp.service';
import { grantCredits } from './credits.service';

// Daily reward configuration
const DAILY_REWARDS = [
  { day: 1, credits: 10, xp: 10, type: 'credits' as const },
  { day: 2, credits: 15, xp: 15, type: 'credits' as const },
  { day: 3, credits: 20, xp: 20, type: 'credits' as const },
  { day: 4, credits: 25, xp: 25, type: 'credits' as const },
  { day: 5, credits: 30, xp: 30, type: 'credits' as const },
  { day: 6, credits: 40, xp: 40, type: 'credits' as const },
  { day: 7, credits: 100, xp: 50, type: 'special' as const }, // Jackpot day
];

// Reward type enum
export type RewardType = 'credits' | 'xp' | 'vip_day' | 'special';

// Daily reward claim interface
export interface DailyRewardClaim {
  id: string;
  customer_user_id: string;
  reward_date: Date;
  day_number: number;
  reward_type: RewardType;
  reward_amount: number;
  claimed_at: Date;
}

// Daily reward status
export interface DailyRewardStatus {
  canClaim: boolean;
  currentDay: number;
  nextReward: {
    day: number;
    credits: number;
    xp: number;
    type: RewardType;
  };
  lastClaimDate: Date | null;
  streak: number;
  claimedToday: boolean;
}

/**
 * Get today's date at midnight (UTC)
 */
function getTodayMidnight(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

/**
 * Calculate current day number in cycle (1-7)
 */
export async function getCurrentDayNumber(userId: string): Promise<number> {
  // Get last claim
  const lastClaim = await db
    .selectFrom('customer_daily_rewards')
    .select(['reward_date', 'day_number'])
    .where('customer_user_id', '=', userId)
    .orderBy('reward_date', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (!lastClaim) {
    return 1; // First time claiming
  }

  const today = getTodayMidnight();
  const lastClaimDate = new Date(lastClaim.reward_date);
  lastClaimDate.setUTCHours(0, 0, 0, 0);

  // Check if last claim was yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastClaimDate.getTime() === yesterday.getTime()) {
    // Continue streak
    const nextDay = lastClaim.day_number + 1;
    return nextDay > 7 ? 1 : nextDay; // Reset to 1 after day 7
  } else if (lastClaimDate.getTime() < yesterday.getTime()) {
    // Streak broken, reset to day 1
    return 1;
  } else {
    // Last claim was today (should not happen, but handle gracefully)
    return lastClaim.day_number;
  }
}

/**
 * Get daily reward status for user
 */
export async function getDailyRewardStatus(userId: string): Promise<DailyRewardStatus> {
  const today = getTodayMidnight();

  // Check if already claimed today
  const todayClaim = await db
    .selectFrom('customer_daily_rewards')
    .select(['reward_date', 'day_number'])
    .where('customer_user_id', '=', userId)
    .where('reward_date', '=', today)
    .executeTakeFirst();

  const claimedToday = !!todayClaim;

  // Get last claim for streak calculation
  const lastClaim = await db
    .selectFrom('customer_daily_rewards')
    .select(['reward_date', 'day_number'])
    .where('customer_user_id', '=', userId)
    .orderBy('reward_date', 'desc')
    .limit(1)
    .executeTakeFirst();

  // Calculate current day number
  const currentDay = await getCurrentDayNumber(userId);

  // Calculate streak (consecutive days)
  let streak = 0;
  if (lastClaim) {
    const lastClaimDate = new Date(lastClaim.reward_date);
    lastClaimDate.setUTCHours(0, 0, 0, 0);

    const daysSinceLastClaim = Math.floor(
      (today.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastClaim === 0) {
      // Claimed today
      streak = lastClaim.day_number;
    } else if (daysSinceLastClaim === 1) {
      // Claimed yesterday
      streak = lastClaim.day_number;
    } else {
      // Streak broken
      streak = 0;
    }
  }

  const nextReward = DAILY_REWARDS[currentDay - 1];

  return {
    canClaim: !claimedToday,
    currentDay,
    nextReward: {
      day: nextReward.day,
      credits: nextReward.credits,
      xp: nextReward.xp,
      type: nextReward.type,
    },
    lastClaimDate: lastClaim?.reward_date || null,
    streak,
    claimedToday,
  };
}

/**
 * Claim daily reward
 */
export async function claimDailyReward(
  userId: string
): Promise<{ success: boolean; reward: any; message: string }> {
  return db.transaction().execute(async (trx) => {
    const today = getTodayMidnight();

    // Check if already claimed today
    const todayClaim = await trx
      .selectFrom('customer_daily_rewards')
      .select('id')
      .where('customer_user_id', '=', userId)
      .where('reward_date', '=', today)
      .executeTakeFirst();

    if (todayClaim) {
      throw new Error('Daily reward already claimed today');
    }

    // Calculate current day number
    const currentDay = await getCurrentDayNumber(userId);
    const reward = DAILY_REWARDS[currentDay - 1];

    // Record claim
    const claim = await trx
      .insertInto('customer_daily_rewards')
      .values({
        customer_user_id: userId,
        reward_date: today,
        day_number: currentDay,
        reward_type: reward.type,
        reward_amount: reward.credits,
        claimed_at: sql`NOW()`,
      })
      .returning(['id', 'day_number', 'reward_type', 'reward_amount'])
      .executeTakeFirstOrThrow();

    // Grant credits
    await grantCredits({
      userId,
      amount: reward.credits,
      transactionType: 'daily_reward',
      description: `Günlük ödül (Gün ${currentDay})`,
      referenceId: claim.id,
      referenceType: 'daily_reward',
    });

    // Grant XP
    await grantXP({
      userId,
      amount: reward.xp,
      transactionType: XPTransactionType.DAILY_LOGIN,
      description: `Günlük ödül (Gün ${currentDay})`,
      referenceId: claim.id,
      referenceType: 'daily_reward',
    });

    // Special reward for day 7
    let specialMessage = '';
    if (currentDay === 7) {
      specialMessage = ' 🎉 JACKPOT! Haftalık seriyi tamamladın!';

      // Could add additional special reward here (e.g., VIP day)
      // For now, the 100 credits + 50 XP is the jackpot
    }

    return {
      success: true,
      reward: {
        day: currentDay,
        credits: reward.credits,
        xp: reward.xp,
        type: reward.type,
      },
      message: `Günlük ödül alındı! ${reward.credits} kredi + ${reward.xp} XP${specialMessage}`,
    };
  });
}

/**
 * Get daily reward claim history
 */
export async function getDailyRewardHistory(
  userId: string,
  limit: number = 30
): Promise<DailyRewardClaim[]> {
  const history = await db
    .selectFrom('customer_daily_rewards')
    .selectAll()
    .where('customer_user_id', '=', userId)
    .orderBy('reward_date', 'desc')
    .limit(limit)
    .execute();

  return history as DailyRewardClaim[];
}

/**
 * Get daily reward statistics (all users)
 */
export async function getDailyRewardStats() {
  const today = getTodayMidnight();

  const stats = await db
    .selectFrom('customer_daily_rewards')
    .select([
      sql<number>`COUNT(DISTINCT customer_user_id)`.as('total_claimers'),
      sql<number>`COUNT(*) FILTER (WHERE reward_date = ${today})`.as('claimed_today'),
      sql<number>`COUNT(*) FILTER (WHERE day_number = 7)`.as('jackpot_claims'),
      sql<number>`SUM(reward_amount)`.as('total_credits_distributed'),
    ])
    .executeTakeFirst();

  return {
    totalClaimers: Number(stats?.total_claimers || 0),
    claimedToday: Number(stats?.claimed_today || 0),
    jackpotClaims: Number(stats?.jackpot_claims || 0),
    totalCreditsDistributed: Number(stats?.total_credits_distributed || 0),
  };
}

/**
 * Get daily reward calendar (7-day preview)
 */
export function getDailyRewardCalendar() {
  return DAILY_REWARDS.map((reward) => ({
    day: reward.day,
    credits: reward.credits,
    xp: reward.xp,
    type: reward.type,
    isJackpot: reward.day === 7,
  }));
}

/**
 * Referrals Service - Referral Program Management
 *
 * 3-Tier Referral System:
 * - Tier 1 (Pending): Friend signs up → Referrer: 50 XP + 10 credits
 * - Tier 2 (Completed): Friend logs in → Referrer: +50 credits, Friend: 10 credits
 * - Tier 3 (Rewarded): Friend subscribes → Referrer: +200 credits
 *
 * Referral Code Format: GOAL-XXXXX (5 random alphanumeric chars)
 */

import { db } from '../database/kysely';
import { sql } from 'kysely';
import { grantXP } from './xp.service';
import { grantCredits } from './credits.service';

// Referral status types
export type ReferralStatus = 'pending' | 'completed' | 'rewarded' | 'expired';

// Referral tier levels
export type ReferralTier = 1 | 2 | 3;

// Referral interface
export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  status: ReferralStatus;
  tier: ReferralTier;
  referrer_reward_xp: number;
  referrer_reward_credits: number;
  referred_reward_xp: number;
  referred_reward_credits: number;
  referred_subscribed_at: Date | null;
  reward_claimed_at: Date | null;
  created_at: Date;
  expires_at: Date;
}

// Reward configuration
const REFERRAL_REWARDS = {
  tier1: {
    referrer_xp: 50,
    referrer_credits: 10,
    referred_xp: 0,
    referred_credits: 0,
  },
  tier2: {
    referrer_xp: 0,
    referrer_credits: 50,
    referred_xp: 0,
    referred_credits: 10,
  },
  tier3: {
    referrer_xp: 0,
    referrer_credits: 200,
    referred_xp: 0,
    referred_credits: 0,
  },
};

/**
 * Generate unique referral code
 * Format: GOAL-XXXXX (e.g., GOAL-A3B7K)
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'GOAL-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get or create user's referral code
 */
export async function getUserReferralCode(userId: string): Promise<string> {
  // Check if user already has a referral code in customer_users
  const user = await db
    .selectFrom('customer_users')
    .select('referral_code')
    .where('id', '=', userId)
    .executeTakeFirst();

  if (user?.referral_code) {
    return user.referral_code;
  }

  // Generate new code and update user
  let newCode: string;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    newCode = generateReferralCode();

    // Check if code is unique
    const existing = await db
      .selectFrom('customer_users')
      .select('id')
      .where('referral_code', '=', newCode)
      .executeTakeFirst();

    if (!existing) {
      isUnique = true;

      // Update user with new code
      await db
        .updateTable('customer_users')
        .set({ referral_code: newCode })
        .where('id', '=', userId)
        .execute();

      return newCode;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique referral code');
}

/**
 * Apply referral code during signup
 * Creates Tier 1 referral record
 */
export async function applyReferralCode(
  referredUserId: string,
  referralCode: string
): Promise<{ success: boolean; referral?: Referral }> {
  return db.transaction().execute(async (trx) => {
    // 1. Find referrer by code
    const referrer = await trx
      .selectFrom('customer_users')
      .select(['id', 'referral_code'])
      .where('referral_code', '=', referralCode)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!referrer) {
      throw new Error('Invalid referral code');
    }

    // 2. Prevent self-referral
    if (referrer.id === referredUserId) {
      throw new Error('Cannot refer yourself');
    }

    // 3. Check if referred user already has a referral
    const existingReferral = await trx
      .selectFrom('referrals')
      .select('id')
      .where('referred_user_id', '=', referredUserId)
      .executeTakeFirst();

    if (existingReferral) {
      throw new Error('User already has a referral');
    }

    // 4. Create Tier 1 referral
    const referral = await trx
      .insertInto('referrals')
      .values({
        referrer_user_id: referrer.id,
        referred_user_id: referredUserId,
        referral_code: referralCode,
        status: 'pending',
        tier: 1,
        referrer_reward_xp: REFERRAL_REWARDS.tier1.referrer_xp,
        referrer_reward_credits: REFERRAL_REWARDS.tier1.referrer_credits,
        referred_reward_xp: REFERRAL_REWARDS.tier1.referred_xp,
        referred_reward_credits: REFERRAL_REWARDS.tier1.referred_credits,
        referred_subscribed_at: null,
        reward_claimed_at: null,
        created_at: sql`NOW()`,
        expires_at: sql`NOW() + INTERVAL '30 days'`,
      })
      .returning([
        'id',
        'referrer_user_id',
        'referred_user_id',
        'referral_code',
        'status',
        'tier',
        'created_at',
      ])
      .executeTakeFirstOrThrow();

    // 5. Grant Tier 1 rewards to referrer
    await grantXP({
      userId: referrer.id,
      amount: REFERRAL_REWARDS.tier1.referrer_xp,
      transactionType: 'referral_signup',
      description: `Arkadaşını davet ettin! (${referralCode})`,
      referenceId: referral.id,
      referenceType: 'referral',
    });

    await grantCredits({
      userId: referrer.id,
      amount: REFERRAL_REWARDS.tier1.referrer_credits,
      transactionType: 'referral_bonus',
      description: `Referral Tier 1: Arkadaşın kayıt oldu`,
      referenceId: referral.id,
      referenceType: 'referral',
    });

    return { success: true, referral: referral as any };
  });
}

/**
 * Process Tier 2 reward (first login)
 * Called after referred user's first successful login
 */
export async function processReferralTier2(referredUserId: string): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    // 1. Find Tier 1 referral
    const referral = await trx
      .selectFrom('referrals')
      .selectAll()
      .where('referred_user_id', '=', referredUserId)
      .where('status', '=', 'pending')
      .where('tier', '=', 1)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();

    if (!referral) {
      return false; // No active referral found
    }

    // 2. Update to Tier 2
    await trx
      .updateTable('referrals')
      .set({
        status: 'completed',
        tier: 2,
        referrer_reward_credits: sql`referrer_reward_credits + ${REFERRAL_REWARDS.tier2.referrer_credits}`,
        referred_reward_credits: sql`referred_reward_credits + ${REFERRAL_REWARDS.tier2.referred_credits}`,
      })
      .where('id', '=', referral.id)
      .execute();

    // 3. Grant Tier 2 rewards
    await grantCredits({
      userId: referral.referrer_user_id,
      amount: REFERRAL_REWARDS.tier2.referrer_credits,
      transactionType: 'referral_bonus',
      description: `Referral Tier 2: Arkadaşın giriş yaptı`,
      referenceId: referral.id,
      referenceType: 'referral',
    });

    await grantCredits({
      userId: referredUserId,
      amount: REFERRAL_REWARDS.tier2.referred_credits,
      transactionType: 'referral_bonus',
      description: `Referral bonusu: İlk giriş`,
      referenceId: referral.id,
      referenceType: 'referral',
    });

    // 4. Check and unlock badges
    const { checkAndUnlockBadges } = await import('./badges.service');
    const referrerReferralCount = await trx
      .selectFrom('referrals')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('referrer_user_id', '=', referral.referrer_user_id)
      .where('tier', '>=', 2)
      .executeTakeFirst();

    await checkAndUnlockBadges(
      referral.referrer_user_id,
      'referrals',
      Number(referrerReferralCount?.count || 0)
    );

    return true;
  });
}

/**
 * Process Tier 3 reward (subscription purchase)
 * Called after referred user purchases subscription
 */
export async function processReferralTier3(referredUserId: string): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    // 1. Find Tier 2 referral
    const referral = await trx
      .selectFrom('referrals')
      .selectAll()
      .where('referred_user_id', '=', referredUserId)
      .where('status', '=', 'completed')
      .where('tier', '=', 2)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();

    if (!referral) {
      return false; // No active Tier 2 referral found
    }

    // 2. Update to Tier 3
    await trx
      .updateTable('referrals')
      .set({
        status: 'rewarded',
        tier: 3,
        referrer_reward_credits: sql`referrer_reward_credits + ${REFERRAL_REWARDS.tier3.referrer_credits}`,
        referred_subscribed_at: sql`NOW()`,
        reward_claimed_at: sql`NOW()`,
      })
      .where('id', '=', referral.id)
      .execute();

    // 3. Grant Tier 3 rewards
    await grantCredits({
      userId: referral.referrer_user_id,
      amount: REFERRAL_REWARDS.tier3.referrer_credits,
      transactionType: 'referral_bonus',
      description: `Referral Tier 3: Arkadaşın abone oldu! 🎉`,
      referenceId: referral.id,
      referenceType: 'referral',
    });

    return true;
  });
}

/**
 * Get user's referral statistics
 */
export async function getReferralStats(userId: string) {
  const stats = await db
    .selectFrom('referrals')
    .select([
      sql<number>`COUNT(*)`.as('total_referrals'),
      sql<number>`COUNT(*) FILTER (WHERE tier >= 2)`.as('active_referrals'),
      sql<number>`COUNT(*) FILTER (WHERE tier = 3)`.as('subscribed_referrals'),
      sql<number>`SUM(referrer_reward_xp)`.as('total_xp_earned'),
      sql<number>`SUM(referrer_reward_credits)`.as('total_credits_earned'),
    ])
    .where('referrer_user_id', '=', userId)
    .executeTakeFirst();

  return {
    totalReferrals: Number(stats?.total_referrals || 0),
    activeReferrals: Number(stats?.active_referrals || 0),
    subscribedReferrals: Number(stats?.subscribed_referrals || 0),
    totalXPEarned: Number(stats?.total_xp_earned || 0),
    totalCreditsEarned: Number(stats?.total_credits_earned || 0),
  };
}

/**
 * Get user's referral list
 */
export async function getUserReferrals(userId: string, limit: number = 50, offset: number = 0) {
  const referrals = await db
    .selectFrom('referrals as r')
    .innerJoin('customer_users as cu', 'cu.id', 'r.referred_user_id')
    .select([
      'r.id',
      'r.referral_code',
      'r.status',
      'r.tier',
      'r.referrer_reward_xp',
      'r.referrer_reward_credits',
      'r.created_at',
      'r.referred_subscribed_at',
      'cu.full_name as referred_user_name',
      'cu.username as referred_username',
    ])
    .where('r.referrer_user_id', '=', userId)
    .orderBy('r.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();

  return referrals.map((ref) => ({
    id: ref.id,
    referralCode: ref.referral_code,
    status: ref.status,
    tier: ref.tier,
    rewardXP: ref.referrer_reward_xp,
    rewardCredits: ref.referrer_reward_credits,
    referredUserName: ref.referred_user_name,
    referredUsername: ref.referred_username,
    createdAt: ref.created_at,
    subscribedAt: ref.referred_subscribed_at,
  }));
}

/**
 * Get referral leaderboard (top referrers)
 */
export async function getReferralLeaderboard(limit: number = 100) {
  const leaderboard = await db
    .selectFrom('referrals as r')
    .innerJoin('customer_users as cu', 'cu.id', 'r.referrer_user_id')
    .select([
      'cu.id',
      'cu.full_name as name',
      'cu.username',
      sql<number>`COUNT(r.id)`.as('total_referrals'),
      sql<number>`COUNT(r.id) FILTER (WHERE r.tier >= 2)`.as('active_referrals'),
      sql<number>`COUNT(r.id) FILTER (WHERE r.tier = 3)`.as('subscribed_referrals'),
      sql<number>`SUM(r.referrer_reward_credits)`.as('total_credits_earned'),
    ])
    .where('cu.deleted_at', 'is', null)
    .groupBy(['cu.id', 'cu.full_name', 'cu.username'])
    .orderBy(sql`COUNT(r.id) FILTER (WHERE r.tier = 3)`, 'desc')
    .orderBy(sql`COUNT(r.id)`, 'desc')
    .limit(limit)
    .execute();

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    userId: entry.id,
    name: entry.name,
    username: entry.username,
    totalReferrals: Number(entry.total_referrals),
    activeReferrals: Number(entry.active_referrals),
    subscribedReferrals: Number(entry.subscribed_referrals),
    totalCreditsEarned: Number(entry.total_credits_earned),
  }));
}

/**
 * Validate referral code
 */
export async function validateReferralCode(code: string): Promise<{ valid: boolean; userId?: string }> {
  const user = await db
    .selectFrom('customer_users')
    .select('id')
    .where('referral_code', '=', code)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  return {
    valid: !!user,
    userId: user?.id,
  };
}

/**
 * Expire old pending referrals (cron job)
 */
export async function expireOldReferrals(): Promise<number> {
  const result = await db
    .updateTable('referrals')
    .set({ status: 'expired' })
    .where('status', '=', 'pending')
    .where('expires_at', '<', new Date())
    .executeTakeFirst();

  return Number(result.numUpdatedRows || 0);
}

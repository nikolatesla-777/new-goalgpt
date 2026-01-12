/**
 * Badge Service - Achievement and Milestone Tracking
 * 
 * Manages badge definitions, unlock conditions, and user badge collection.
 * Integrates with XP and Credits systems for rewards.
 */

import { db } from '../database/kysely';
import { sql } from 'kysely';

// Badge rarity types
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

// Badge categories
export type BadgeCategory = 'achievement' | 'milestone' | 'special' | 'seasonal';

// Unlock condition types
export interface UnlockCondition {
  type: 'referrals' | 'predictions' | 'login_streak' | 'comments' | 'xp_level' | 'credits_earned' | 'manual';
  count?: number;
  accuracy?: number;
  min_count?: number;
  days?: number;
  level?: string;
  amount?: number;
}

// Badge interface
export interface Badge {
  id: string;
  slug: string;
  name_tr: string;
  name_en: string;
  description_tr: string | null;
  description_en: string | null;
  icon_url: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  unlock_condition: UnlockCondition;
  reward_xp: number;
  reward_credits: number;
  reward_vip_days: number;
  is_active: boolean;
  display_order: number;
  total_unlocks: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// User badge interface
export interface UserBadge {
  id: string;
  customer_user_id: string;
  badge_id: string;
  unlocked_at: Date;
  claimed_at: Date | null;
  is_displayed: boolean;
  metadata: any;
}

/**
 * Get all active badges
 */
export async function getAllBadges(category?: BadgeCategory, rarity?: BadgeRarity) {
  let query = db
    .selectFrom('badges')
    .selectAll()
    .where('is_active', '=', true)
    .where('deleted_at', 'is', null)
    .orderBy('display_order', 'asc')
    .orderBy('rarity', 'desc');

  if (category) {
    query = query.where('category', '=', category);
  }

  if (rarity) {
    query = query.where('rarity', '=', rarity);
  }

  const badges = await query.execute();
  return badges;
}

/**
 * Get badge by slug
 */
export async function getBadgeBySlug(slug: string): Promise<Badge | undefined> {
  const badge = await db
    .selectFrom('badges')
    .selectAll()
    .where('slug', '=', slug)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  return badge as Badge | undefined;
}

/**
 * Get user's badges
 */
export async function getUserBadges(userId: string) {
  const badges = await db
    .selectFrom('customer_badges as cb')
    .innerJoin('badges as b', 'b.id', 'cb.badge_id')
    .select([
      'cb.id',
      'cb.badge_id',
      'cb.unlocked_at',
      'cb.claimed_at',
      'cb.is_displayed',
      'b.slug',
      'b.name_tr',
      'b.name_en',
      'b.description_tr',
      'b.description_en',
      'b.icon_url',
      'b.category',
      'b.rarity',
      'b.reward_xp',
      'b.reward_credits',
      'b.reward_vip_days',
    ])
    .where('cb.customer_user_id', '=', userId)
    .orderBy('cb.unlocked_at', 'desc')
    .execute();

  return badges;
}

/**
 * Check if user has badge
 */
export async function userHasBadge(userId: string, badgeSlug: string): Promise<boolean> {
  const badge = await getBadgeBySlug(badgeSlug);
  if (!badge) return false;

  const userBadge = await db
    .selectFrom('customer_badges')
    .select('id')
    .where('customer_user_id', '=', userId)
    .where('badge_id', '=', badge.id)
    .executeTakeFirst();

  return !!userBadge;
}

/**
 * Unlock badge for user
 */
export async function unlockBadge(
  userId: string,
  badgeSlug: string,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; badge?: any; alreadyUnlocked?: boolean }> {
  return db.transaction().execute(async (trx) => {
    // 1. Get badge
    const badge = await trx
      .selectFrom('badges')
      .selectAll()
      .where('slug', '=', badgeSlug)
      .where('is_active', '=', true)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!badge) {
      throw new Error(`Badge '${badgeSlug}' not found or inactive`);
    }

    // 2. Check if already unlocked
    const existingBadge = await trx
      .selectFrom('customer_badges')
      .select('id')
      .where('customer_user_id', '=', userId)
      .where('badge_id', '=', badge.id)
      .executeTakeFirst();

    if (existingBadge) {
      return { success: true, alreadyUnlocked: true, badge };
    }

    // 3. Unlock badge
    const unlockedBadge = await trx
      .insertInto('customer_badges')
      .values({
        customer_user_id: userId,
        badge_id: badge.id,
        unlocked_at: sql`NOW()`,
        claimed_at: null,
        is_displayed: false,
        metadata: JSON.stringify(metadata),
      })
      .returning(['id', 'badge_id', 'unlocked_at'])
      .executeTakeFirstOrThrow();

    // 4. Update badge total unlocks
    await trx
      .updateTable('badges')
      .set({
        total_unlocks: sql`total_unlocks + 1`,
        updated_at: sql`NOW()`,
      })
      .where('id', '=', badge.id)
      .execute();

    // 5. Grant rewards (XP and Credits)
    if (badge.reward_xp > 0) {
      const { grantXP } = await import('./xp.service');
      await grantXP({
        userId,
        amount: badge.reward_xp,
        transactionType: 'badge_unlock',
        description: `Badge unlocked: ${badge.name_tr}`,
        referenceId: unlockedBadge.id,
        referenceType: 'badge',
        metadata: { badge_slug: badgeSlug, badge_rarity: badge.rarity },
      });
    }

    if (badge.reward_credits > 0) {
      const { grantCredits } = await import('./credits.service');
      await grantCredits({
        userId,
        amount: badge.reward_credits,
        transactionType: 'badge_reward',
        description: `Badge reward: ${badge.name_tr}`,
        referenceId: unlockedBadge.id,
        referenceType: 'badge',
        metadata: { badge_slug: badgeSlug, badge_rarity: badge.rarity },
      });
    }

    // TODO: Handle reward_vip_days (requires subscription service)

    return {
      success: true,
      badge: {
        ...badge,
        unlocked_at: unlockedBadge.unlocked_at,
        user_badge_id: unlockedBadge.id,
      },
    };
  });
}

/**
 * Claim badge rewards (mark as claimed)
 */
export async function claimBadge(userId: string, badgeId: string): Promise<{ success: boolean }> {
  const result = await db
    .updateTable('customer_badges')
    .set({
      claimed_at: sql`NOW()`,
    })
    .where('customer_user_id', '=', userId)
    .where('badge_id', '=', badgeId)
    .where('claimed_at', 'is', null)
    .executeTakeFirst();

  if (result.numUpdatedRows === 0n) {
    throw new Error('Badge not found or already claimed');
  }

  return { success: true };
}

/**
 * Display/hide badge on profile
 */
export async function toggleBadgeDisplay(
  userId: string,
  badgeId: string,
  isDisplayed: boolean
): Promise<{ success: boolean }> {
  const result = await db
    .updateTable('customer_badges')
    .set({
      is_displayed: isDisplayed,
    })
    .where('customer_user_id', '=', userId)
    .where('badge_id', '=', badgeId)
    .executeTakeFirst();

  if (result.numUpdatedRows === 0n) {
    throw new Error('Badge not found');
  }

  return { success: true };
}

/**
 * Check and unlock badges based on condition
 * Called from other services (XP, Credits, Referrals, etc.)
 */
export async function checkAndUnlockBadges(userId: string, conditionType: string, value: any) {
  // Get all badges matching condition type
  const badges = await db
    .selectFrom('badges')
    .selectAll()
    .where('is_active', '=', true)
    .where('deleted_at', 'is', null)
    .execute();

  const unlockedBadges: any[] = [];

  for (const badge of badges) {
    const condition = badge.unlock_condition as UnlockCondition;

    // Skip if condition type doesn't match
    if (condition.type !== conditionType) continue;

    // Check if user already has badge
    const hasBadge = await userHasBadge(userId, badge.slug);
    if (hasBadge) continue;

    // Check condition
    let shouldUnlock = false;

    switch (conditionType) {
      case 'referrals':
        shouldUnlock = value >= (condition.count || 0);
        break;

      case 'predictions':
        // value = { correct_count: number, total_count: number }
        if (condition.accuracy) {
          const accuracy = (value.correct_count / value.total_count) * 100;
          shouldUnlock = accuracy >= condition.accuracy && value.total_count >= (condition.min_count || 0);
        } else if (condition.count) {
          shouldUnlock = value.correct_count >= condition.count;
        }
        break;

      case 'login_streak':
        shouldUnlock = value >= (condition.days || 0);
        break;

      case 'comments':
        shouldUnlock = value >= (condition.count || 0);
        break;

      case 'xp_level':
        shouldUnlock = value === condition.level;
        break;

      case 'credits_earned':
        shouldUnlock = value >= (condition.amount || 0);
        break;

      default:
        break;
    }

    // Unlock badge if condition met
    if (shouldUnlock) {
      try {
        const result = await unlockBadge(userId, badge.slug, {
          condition_type: conditionType,
          condition_value: value,
          auto_unlocked: true,
        });

        if (result.success && !result.alreadyUnlocked) {
          unlockedBadges.push(result.badge);
        }
      } catch (error) {
        console.error(`Failed to unlock badge ${badge.slug}:`, error);
      }
    }
  }

  return unlockedBadges;
}

/**
 * Get badge statistics
 */
export async function getBadgeStats() {
  const stats = await db
    .selectFrom('badges')
    .select([
      sql<number>`COUNT(*)`.as('total_badges'),
      sql<number>`COUNT(*) FILTER (WHERE is_active = true)`.as('active_badges'),
      sql<number>`SUM(total_unlocks)`.as('total_unlocks'),
      sql<number>`COUNT(*) FILTER (WHERE category = 'achievement')`.as('achievement_badges'),
      sql<number>`COUNT(*) FILTER (WHERE category = 'milestone')`.as('milestone_badges'),
      sql<number>`COUNT(*) FILTER (WHERE category = 'special')`.as('special_badges'),
      sql<number>`COUNT(*) FILTER (WHERE category = 'seasonal')`.as('seasonal_badges'),
      sql<number>`COUNT(*) FILTER (WHERE rarity = 'common')`.as('common_badges'),
      sql<number>`COUNT(*) FILTER (WHERE rarity = 'rare')`.as('rare_badges'),
      sql<number>`COUNT(*) FILTER (WHERE rarity = 'epic')`.as('epic_badges'),
      sql<number>`COUNT(*) FILTER (WHERE rarity = 'legendary')`.as('legendary_badges'),
    ])
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  return stats;
}

/**
 * Get top badge collectors (leaderboard)
 */
export async function getBadgeLeaderboard(limit: number = 100) {
  const leaderboard = await db
    .selectFrom('customer_badges as cb')
    .innerJoin('customer_users as cu', 'cu.id', 'cb.customer_user_id')
    .select([
      'cu.id',
      'cu.full_name as name',
      'cu.username',
      sql<number>`COUNT(cb.id)`.as('badge_count'),
      sql<number>`COUNT(cb.id) FILTER (WHERE cb.claimed_at IS NOT NULL)`.as('claimed_count'),
      sql<string>`MAX(cb.unlocked_at)`.as('last_badge_unlocked'),
    ])
    .where('cu.deleted_at', 'is', null)
    .groupBy(['cu.id', 'cu.full_name', 'cu.username'])
    .orderBy(sql`COUNT(cb.id)`, 'desc')
    .limit(limit)
    .execute();

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    userId: entry.id,
    name: entry.name,
    username: entry.username,
    badgeCount: Number(entry.badge_count),
    claimedCount: Number(entry.claimed_count),
    lastBadgeUnlocked: entry.last_badge_unlocked,
  }));
}

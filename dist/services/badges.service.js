"use strict";
/**
 * Badge Service - Achievement and Milestone Tracking
 *
 * Manages badge definitions, unlock conditions, and user badge collection.
 * Integrates with XP and Credits systems for rewards.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllBadges = getAllBadges;
exports.getBadgeBySlug = getBadgeBySlug;
exports.getUserBadges = getUserBadges;
exports.userHasBadge = userHasBadge;
exports.unlockBadge = unlockBadge;
exports.claimBadge = claimBadge;
exports.toggleBadgeDisplay = toggleBadgeDisplay;
exports.checkAndUnlockBadges = checkAndUnlockBadges;
exports.getBadgeStats = getBadgeStats;
exports.getBadgeLeaderboard = getBadgeLeaderboard;
const kysely_1 = require("../database/kysely");
const kysely_2 = require("kysely");
/**
 * Get all active badges
 */
async function getAllBadges(category, rarity) {
    let query = kysely_1.db
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
async function getBadgeBySlug(slug) {
    const badge = await kysely_1.db
        .selectFrom('badges')
        .selectAll()
        .where('slug', '=', slug)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    return badge;
}
/**
 * Get user's badges
 */
async function getUserBadges(userId) {
    const badges = await kysely_1.db
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
async function userHasBadge(userId, badgeSlug) {
    const badge = await getBadgeBySlug(badgeSlug);
    if (!badge)
        return false;
    const userBadge = await kysely_1.db
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
async function unlockBadge(userId, badgeSlug, metadata = {}) {
    return kysely_1.db.transaction().execute(async (trx) => {
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
            unlocked_at: (0, kysely_2.sql) `NOW()`,
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
            total_unlocks: (0, kysely_2.sql) `total_unlocks + 1`,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .where('id', '=', badge.id)
            .execute();
        // 5. Grant rewards (XP and Credits)
        if (badge.reward_xp > 0) {
            const { grantXP } = await Promise.resolve().then(() => __importStar(require('./xp.service')));
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
            const { grantCredits } = await Promise.resolve().then(() => __importStar(require('./credits.service')));
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
async function claimBadge(userId, badgeId) {
    const result = await kysely_1.db
        .updateTable('customer_badges')
        .set({
        claimed_at: (0, kysely_2.sql) `NOW()`,
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
async function toggleBadgeDisplay(userId, badgeId, isDisplayed) {
    const result = await kysely_1.db
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
async function checkAndUnlockBadges(userId, conditionType, value) {
    // Get all badges matching condition type
    const badges = await kysely_1.db
        .selectFrom('badges')
        .selectAll()
        .where('is_active', '=', true)
        .where('deleted_at', 'is', null)
        .execute();
    const unlockedBadges = [];
    for (const badge of badges) {
        const condition = badge.unlock_condition;
        // Skip if condition type doesn't match
        if (condition.type !== conditionType)
            continue;
        // Check if user already has badge
        const hasBadge = await userHasBadge(userId, badge.slug);
        if (hasBadge)
            continue;
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
                }
                else if (condition.count) {
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
            }
            catch (error) {
                console.error(`Failed to unlock badge ${badge.slug}:`, error);
            }
        }
    }
    return unlockedBadges;
}
/**
 * Get badge statistics
 */
async function getBadgeStats() {
    const stats = await kysely_1.db
        .selectFrom('badges')
        .select([
        (0, kysely_2.sql) `COUNT(*)`.as('total_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE is_active = true)`.as('active_badges'),
        (0, kysely_2.sql) `SUM(total_unlocks)`.as('total_unlocks'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE category = 'achievement')`.as('achievement_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE category = 'milestone')`.as('milestone_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE category = 'special')`.as('special_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE category = 'seasonal')`.as('seasonal_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE rarity = 'common')`.as('common_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE rarity = 'rare')`.as('rare_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE rarity = 'epic')`.as('epic_badges'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE rarity = 'legendary')`.as('legendary_badges'),
    ])
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    return stats;
}
/**
 * Get top badge collectors (leaderboard)
 */
async function getBadgeLeaderboard(limit = 100) {
    const leaderboard = await kysely_1.db
        .selectFrom('customer_badges as cb')
        .innerJoin('customer_users as cu', 'cu.id', 'cb.customer_user_id')
        .select([
        'cu.id',
        'cu.full_name as name',
        'cu.username',
        (0, kysely_2.sql) `COUNT(cb.id)`.as('badge_count'),
        (0, kysely_2.sql) `COUNT(cb.id) FILTER (WHERE cb.claimed_at IS NOT NULL)`.as('claimed_count'),
        (0, kysely_2.sql) `MAX(cb.unlocked_at)`.as('last_badge_unlocked'),
    ])
        .where('cu.deleted_at', 'is', null)
        .groupBy(['cu.id', 'cu.full_name', 'cu.username'])
        .orderBy((0, kysely_2.sql) `COUNT(cb.id)`, 'desc')
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

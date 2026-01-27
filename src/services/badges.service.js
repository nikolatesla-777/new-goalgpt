"use strict";
/**
 * Badge Service - Achievement and Milestone Tracking
 *
 * Manages badge definitions, unlock conditions, and user badge collection.
 * Integrates with XP and Credits systems for rewards.
 */
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
/**
 * Get all active badges
 */
function getAllBadges(category, rarity) {
    return __awaiter(this, void 0, void 0, function () {
        var query, badges;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = kysely_1.db
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
                    return [4 /*yield*/, query.execute()];
                case 1:
                    badges = _a.sent();
                    return [2 /*return*/, badges];
            }
        });
    });
}
/**
 * Get badge by slug
 */
function getBadgeBySlug(slug) {
    return __awaiter(this, void 0, void 0, function () {
        var badge;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('badges')
                        .selectAll()
                        .where('slug', '=', slug)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    badge = _a.sent();
                    return [2 /*return*/, badge];
            }
        });
    });
}
/**
 * Get user's badges
 */
function getUserBadges(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var badges;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
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
                        .execute()];
                case 1:
                    badges = _a.sent();
                    return [2 /*return*/, badges];
            }
        });
    });
}
/**
 * Check if user has badge
 */
function userHasBadge(userId, badgeSlug) {
    return __awaiter(this, void 0, void 0, function () {
        var badge, userBadge;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBadgeBySlug(badgeSlug)];
                case 1:
                    badge = _a.sent();
                    if (!badge)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_badges')
                            .select('id')
                            .where('customer_user_id', '=', userId)
                            .where('badge_id', '=', badge.id)
                            .executeTakeFirst()];
                case 2:
                    userBadge = _a.sent();
                    return [2 /*return*/, !!userBadge];
            }
        });
    });
}
/**
 * Unlock badge for user
 */
function unlockBadge(userId_1, badgeSlug_1) {
    return __awaiter(this, arguments, void 0, function (userId, badgeSlug, metadata) {
        var _this = this;
        if (metadata === void 0) { metadata = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var badge, existingBadge, unlockedBadge, _a, grantXP, XPTransactionType, grantCredits;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('badges')
                                    .selectAll()
                                    .where('slug', '=', badgeSlug)
                                    .where('is_active', '=', true)
                                    .where('deleted_at', 'is', null)
                                    .executeTakeFirst()];
                            case 1:
                                badge = _b.sent();
                                if (!badge) {
                                    throw new Error("Badge '".concat(badgeSlug, "' not found or inactive"));
                                }
                                return [4 /*yield*/, trx
                                        .selectFrom('customer_badges')
                                        .select('id')
                                        .where('customer_user_id', '=', userId)
                                        .where('badge_id', '=', badge.id)
                                        .executeTakeFirst()];
                            case 2:
                                existingBadge = _b.sent();
                                if (existingBadge) {
                                    return [2 /*return*/, { success: true, alreadyUnlocked: true, badge: badge }];
                                }
                                return [4 /*yield*/, trx
                                        .insertInto('customer_badges')
                                        .values({
                                        customer_user_id: userId,
                                        badge_id: badge.id,
                                        unlocked_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        claimed_at: null,
                                        is_displayed: false,
                                        metadata: JSON.stringify(metadata),
                                    })
                                        .returning(['id', 'badge_id', 'unlocked_at'])
                                        .executeTakeFirstOrThrow()];
                            case 3:
                                unlockedBadge = _b.sent();
                                // 4. Update badge total unlocks
                                return [4 /*yield*/, trx
                                        .updateTable('badges')
                                        .set({
                                        total_unlocks: (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["total_unlocks + 1"], ["total_unlocks + 1"]))),
                                        updated_at: (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('id', '=', badge.id)
                                        .execute()];
                            case 4:
                                // 4. Update badge total unlocks
                                _b.sent();
                                if (!(badge.reward_xp > 0)) return [3 /*break*/, 7];
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./xp.service')); })];
                            case 5:
                                _a = _b.sent(), grantXP = _a.grantXP, XPTransactionType = _a.XPTransactionType;
                                return [4 /*yield*/, grantXP({
                                        userId: userId,
                                        amount: badge.reward_xp,
                                        transactionType: XPTransactionType.BADGE_UNLOCK,
                                        description: "Badge unlocked: ".concat(badge.name_tr),
                                        referenceId: unlockedBadge.id,
                                        referenceType: 'badge',
                                        metadata: { badge_slug: badgeSlug, badge_rarity: badge.rarity },
                                    })];
                            case 6:
                                _b.sent();
                                _b.label = 7;
                            case 7:
                                if (!(badge.reward_credits > 0)) return [3 /*break*/, 10];
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./credits.service')); })];
                            case 8:
                                grantCredits = (_b.sent()).grantCredits;
                                return [4 /*yield*/, grantCredits({
                                        userId: userId,
                                        amount: badge.reward_credits,
                                        transactionType: 'badge_reward',
                                        description: "Badge reward: ".concat(badge.name_tr),
                                        referenceId: unlockedBadge.id,
                                        referenceType: 'badge',
                                        metadata: { badge_slug: badgeSlug, badge_rarity: badge.rarity },
                                    })];
                            case 9:
                                _b.sent();
                                _b.label = 10;
                            case 10: 
                            // TODO: Handle reward_vip_days (requires subscription service)
                            return [2 /*return*/, {
                                    success: true,
                                    badge: __assign(__assign({}, badge), { unlocked_at: unlockedBadge.unlocked_at, user_badge_id: unlockedBadge.id }),
                                }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Claim badge rewards (mark as claimed)
 */
function claimBadge(userId, badgeId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('customer_badges')
                        .set({
                        claimed_at: (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('customer_user_id', '=', userId)
                        .where('badge_id', '=', badgeId)
                        .where('claimed_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Badge not found or already claimed');
                    }
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
/**
 * Display/hide badge on profile
 */
function toggleBadgeDisplay(userId, badgeId, isDisplayed) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('customer_badges')
                        .set({
                        is_displayed: isDisplayed,
                    })
                        .where('customer_user_id', '=', userId)
                        .where('badge_id', '=', badgeId)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Badge not found');
                    }
                    return [2 /*return*/, { success: true }];
            }
        });
    });
}
/**
 * Check and unlock badges based on condition
 * Called from other services (XP, Credits, Referrals, etc.)
 */
function checkAndUnlockBadges(userId, conditionType, value) {
    return __awaiter(this, void 0, void 0, function () {
        var badges, unlockedBadges, _i, badges_1, badge, condition, hasBadge, shouldUnlock, accuracy, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('badges')
                        .selectAll()
                        .where('is_active', '=', true)
                        .where('deleted_at', 'is', null)
                        .execute()];
                case 1:
                    badges = _a.sent();
                    unlockedBadges = [];
                    _i = 0, badges_1 = badges;
                    _a.label = 2;
                case 2:
                    if (!(_i < badges_1.length)) return [3 /*break*/, 8];
                    badge = badges_1[_i];
                    condition = badge.unlock_condition;
                    // Skip if condition type doesn't match
                    if (condition.type !== conditionType)
                        return [3 /*break*/, 7];
                    return [4 /*yield*/, userHasBadge(userId, badge.slug)];
                case 3:
                    hasBadge = _a.sent();
                    if (hasBadge)
                        return [3 /*break*/, 7];
                    shouldUnlock = false;
                    switch (conditionType) {
                        case 'referrals':
                            shouldUnlock = value >= (condition.count || 0);
                            break;
                        case 'predictions':
                            // value = { correct_count: number, total_count: number }
                            if (condition.accuracy) {
                                accuracy = (value.correct_count / value.total_count) * 100;
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
                    if (!shouldUnlock) return [3 /*break*/, 7];
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, unlockBadge(userId, badge.slug, {
                            condition_type: conditionType,
                            condition_value: value,
                            auto_unlocked: true,
                        })];
                case 5:
                    result = _a.sent();
                    if (result.success && !result.alreadyUnlocked) {
                        unlockedBadges.push(result.badge);
                    }
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.error("Failed to unlock badge ".concat(badge.slug, ":"), error_1);
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/, unlockedBadges];
            }
        });
    });
}
/**
 * Get badge statistics
 */
function getBadgeStats() {
    return __awaiter(this, void 0, void 0, function () {
        var stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('badges')
                        .select([
                        (0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('total_badges'),
                        (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["COUNT(*) FILTER (WHERE is_active = true)"], ["COUNT(*) FILTER (WHERE is_active = true)"]))).as('active_badges'),
                        (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["SUM(total_unlocks)"], ["SUM(total_unlocks)"]))).as('total_unlocks'),
                        (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["COUNT(*) FILTER (WHERE category = 'achievement')"], ["COUNT(*) FILTER (WHERE category = 'achievement')"]))).as('achievement_badges'),
                        (0, kysely_2.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["COUNT(*) FILTER (WHERE category = 'milestone')"], ["COUNT(*) FILTER (WHERE category = 'milestone')"]))).as('milestone_badges'),
                        (0, kysely_2.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["COUNT(*) FILTER (WHERE category = 'special')"], ["COUNT(*) FILTER (WHERE category = 'special')"]))).as('special_badges'),
                        (0, kysely_2.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["COUNT(*) FILTER (WHERE category = 'seasonal')"], ["COUNT(*) FILTER (WHERE category = 'seasonal')"]))).as('seasonal_badges'),
                        (0, kysely_2.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["COUNT(*) FILTER (WHERE rarity = 'common')"], ["COUNT(*) FILTER (WHERE rarity = 'common')"]))).as('common_badges'),
                        (0, kysely_2.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["COUNT(*) FILTER (WHERE rarity = 'rare')"], ["COUNT(*) FILTER (WHERE rarity = 'rare')"]))).as('rare_badges'),
                        (0, kysely_2.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["COUNT(*) FILTER (WHERE rarity = 'epic')"], ["COUNT(*) FILTER (WHERE rarity = 'epic')"]))).as('epic_badges'),
                        (0, kysely_2.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["COUNT(*) FILTER (WHERE rarity = 'legendary')"], ["COUNT(*) FILTER (WHERE rarity = 'legendary')"]))).as('legendary_badges'),
                    ])
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, stats];
            }
        });
    });
}
/**
 * Get top badge collectors (leaderboard)
 */
function getBadgeLeaderboard() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var leaderboard;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_badges as cb')
                        .innerJoin('customer_users as cu', 'cu.id', 'cb.customer_user_id')
                        .select([
                        'cu.id',
                        'cu.full_name as name',
                        'cu.username',
                        (0, kysely_2.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["COUNT(cb.id)"], ["COUNT(cb.id)"]))).as('badge_count'),
                        (0, kysely_2.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["COUNT(cb.id) FILTER (WHERE cb.claimed_at IS NOT NULL)"], ["COUNT(cb.id) FILTER (WHERE cb.claimed_at IS NOT NULL)"]))).as('claimed_count'),
                        (0, kysely_2.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["MAX(cb.unlocked_at)"], ["MAX(cb.unlocked_at)"]))).as('last_badge_unlocked'),
                    ])
                        .where('cu.deleted_at', 'is', null)
                        .groupBy(['cu.id', 'cu.full_name', 'cu.username'])
                        .orderBy((0, kysely_2.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["COUNT(cb.id)"], ["COUNT(cb.id)"]))), 'desc')
                        .limit(limit)
                        .execute()];
                case 1:
                    leaderboard = _a.sent();
                    return [2 /*return*/, leaderboard.map(function (entry, index) { return ({
                            rank: index + 1,
                            userId: entry.id,
                            name: entry.name,
                            username: entry.username,
                            badgeCount: Number(entry.badge_count),
                            claimedCount: Number(entry.claimed_count),
                            lastBadgeUnlocked: entry.last_badge_unlocked,
                        }); })];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19;

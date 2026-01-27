"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.XP_REWARDS = exports.XPTransactionType = exports.XP_LEVELS = void 0;
exports.calculateLevel = calculateLevel;
exports.calculateLevelProgress = calculateLevelProgress;
exports.getNextLevelXP = getNextLevelXP;
exports.grantXP = grantXP;
exports.updateLoginStreak = updateLoginStreak;
exports.getUserXP = getUserXP;
exports.getXPTransactions = getXPTransactions;
exports.getXPLeaderboard = getXPLeaderboard;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var logger_1 = require("../utils/logger");
// XP requirements for each level
exports.XP_LEVELS = {
    bronze: { min: 0, max: 499, name_tr: 'Bronz', name_en: 'Bronze' },
    silver: { min: 500, max: 1999, name_tr: 'Gümüş', name_en: 'Silver' },
    gold: { min: 2000, max: 4999, name_tr: 'Altın', name_en: 'Gold' },
    platinum: { min: 5000, max: 9999, name_tr: 'Platin', name_en: 'Platinum' },
    diamond: { min: 10000, max: 24999, name_tr: 'Elmas', name_en: 'Diamond' },
    vip_elite: { min: 25000, max: Infinity, name_tr: 'VIP Elite', name_en: 'VIP Elite' },
};
// XP transaction types
var XPTransactionType;
(function (XPTransactionType) {
    XPTransactionType["DAILY_LOGIN"] = "daily_login";
    XPTransactionType["PREDICTION_CORRECT"] = "prediction_correct";
    XPTransactionType["REFERRAL_SIGNUP"] = "referral_signup";
    XPTransactionType["BADGE_UNLOCK"] = "badge_unlock";
    XPTransactionType["MATCH_COMMENT"] = "match_comment";
    XPTransactionType["COMMENT_LIKE"] = "comment_like";
    XPTransactionType["SUBSCRIPTION_PURCHASE"] = "subscription_purchase";
    XPTransactionType["AD_WATCH"] = "ad_watch";
    XPTransactionType["ADMIN_GRANT"] = "admin_grant";
    XPTransactionType["ADMIN_DEDUCT"] = "admin_deduct";
    XPTransactionType["ACHIEVEMENT_UNLOCK"] = "achievement_unlock";
    XPTransactionType["STREAK_BONUS"] = "streak_bonus";
})(XPTransactionType || (exports.XPTransactionType = XPTransactionType = {}));
// XP reward amounts by activity
exports.XP_REWARDS = {
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
/**
 * Calculate level based on XP points
 */
function calculateLevel(xpPoints) {
    if (xpPoints >= exports.XP_LEVELS.vip_elite.min)
        return 'vip_elite';
    if (xpPoints >= exports.XP_LEVELS.diamond.min)
        return 'diamond';
    if (xpPoints >= exports.XP_LEVELS.platinum.min)
        return 'platinum';
    if (xpPoints >= exports.XP_LEVELS.gold.min)
        return 'gold';
    if (xpPoints >= exports.XP_LEVELS.silver.min)
        return 'silver';
    return 'bronze';
}
/**
 * Calculate level progress percentage
 */
function calculateLevelProgress(xpPoints, level) {
    var levelConfig = exports.XP_LEVELS[level];
    // VIP Elite has no upper limit
    if (level === 'vip_elite') {
        return 100;
    }
    var rangeSize = levelConfig.max - levelConfig.min + 1;
    var pointsInLevel = xpPoints - levelConfig.min;
    var progress = (pointsInLevel / rangeSize) * 100;
    return Math.min(100, Math.max(0, progress));
}
/**
 * Get next level XP requirement
 */
function getNextLevelXP(currentLevel) {
    if (currentLevel === 'vip_elite')
        return null; // Max level
    var levels = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'vip_elite'];
    var currentIndex = levels.indexOf(currentLevel);
    var nextLevel = levels[currentIndex + 1];
    return exports.XP_LEVELS[nextLevel].min;
}
/**
 * Grant XP to user (with transaction logging and level-up detection)
 */
function grantXP(params) {
    return __awaiter(this, void 0, void 0, function () {
        var userId, amount, transactionType, description, referenceId, referenceType, _a, metadata;
        var _this = this;
        return __generator(this, function (_b) {
            userId = params.userId, amount = params.amount, transactionType = params.transactionType, description = params.description, referenceId = params.referenceId, referenceType = params.referenceType, _a = params.metadata, metadata = _a === void 0 ? {} : _a;
            if (amount === 0) {
                throw new Error('XP amount cannot be zero');
            }
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var currentXP, oldXP, oldLevel, newXP, newLevel, leveledUp, levelProgress, nextLevelXP, levelUpRewards, levelUpCredits, grantCredits;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('customer_xp')
                                    .select(['xp_points', 'level', 'total_earned'])
                                    .where('customer_user_id', '=', userId)
                                    .executeTakeFirst()];
                            case 1:
                                currentXP = _a.sent();
                                if (!currentXP) {
                                    throw new Error('User XP record not found');
                                }
                                oldXP = currentXP.xp_points;
                                oldLevel = currentXP.level;
                                newXP = Math.max(0, oldXP + amount);
                                newLevel = calculateLevel(newXP);
                                leveledUp = newLevel !== oldLevel;
                                levelProgress = calculateLevelProgress(newXP, newLevel);
                                nextLevelXP = getNextLevelXP(newLevel);
                                return [4 /*yield*/, trx
                                        .updateTable('customer_xp')
                                        .set({
                                        xp_points: newXP,
                                        level: newLevel,
                                        level_progress: levelProgress,
                                        total_earned: amount > 0 ? currentXP.total_earned + amount : currentXP.total_earned,
                                        next_level_xp: nextLevelXP,
                                        updated_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('customer_user_id', '=', userId)
                                        .execute()];
                            case 2:
                                _a.sent();
                                // 3. Log transaction
                                return [4 /*yield*/, trx
                                        .insertInto('customer_xp_transactions')
                                        .values({
                                        customer_user_id: userId,
                                        xp_amount: amount,
                                        transaction_type: transactionType,
                                        description: description || null,
                                        reference_id: referenceId || null,
                                        reference_type: referenceType || null,
                                        metadata: JSON.stringify(metadata),
                                        created_at: (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .execute()];
                            case 3:
                                // 3. Log transaction
                                _a.sent();
                                if (!(leveledUp && amount > 0)) return [3 /*break*/, 8];
                                logger_1.logger.info("User ".concat(userId, " leveled up: ").concat(oldLevel, " \u2192 ").concat(newLevel));
                                levelUpCredits = getLevelUpCredits(newLevel);
                                if (!(levelUpCredits > 0)) return [3 /*break*/, 6];
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./credits.service')); })];
                            case 4:
                                grantCredits = (_a.sent()).grantCredits;
                                return [4 /*yield*/, grantCredits({
                                        userId: userId,
                                        amount: levelUpCredits,
                                        transactionType: 'promotional',
                                        description: "".concat(newLevel.toUpperCase(), " seviyesine ula\u015Ft\u0131n! \uD83C\uDF89"),
                                        metadata: { level_up: true, from: oldLevel, to: newLevel },
                                    })];
                            case 5:
                                _a.sent();
                                levelUpRewards = { credits: levelUpCredits };
                                _a.label = 6;
                            case 6: 
                            // Increment achievements count
                            return [4 /*yield*/, trx
                                    .updateTable('customer_xp')
                                    .set({
                                    achievements_count: (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["achievements_count + 1"], ["achievements_count + 1"]))),
                                })
                                    .where('customer_user_id', '=', userId)
                                    .execute()];
                            case 7:
                                // Increment achievements count
                                _a.sent();
                                _a.label = 8;
                            case 8: return [2 /*return*/, {
                                    success: true,
                                    oldXP: oldXP,
                                    newXP: newXP,
                                    oldLevel: oldLevel,
                                    newLevel: newLevel,
                                    leveledUp: leveledUp,
                                    levelUpRewards: levelUpRewards,
                                }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Get level-up credit rewards
 */
function getLevelUpCredits(level) {
    var rewards = {
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
function updateLoginStreak(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var xpData, now, today, lastActivity, currentStreak, xpGranted, lastActivityDay, yesterday, longestStreak, dailyXP;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('customer_xp')
                                    .select(['current_streak_days', 'longest_streak_days', 'last_activity_date'])
                                    .where('customer_user_id', '=', userId)
                                    .executeTakeFirst()];
                            case 1:
                                xpData = _a.sent();
                                if (!xpData) {
                                    throw new Error('User XP record not found');
                                }
                                now = new Date();
                                today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                lastActivity = xpData.last_activity_date
                                    ? new Date(xpData.last_activity_date)
                                    : null;
                                currentStreak = xpData.current_streak_days;
                                xpGranted = 0;
                                // Check if already logged in today
                                if (lastActivity) {
                                    lastActivityDay = new Date(lastActivity.getFullYear(), lastActivity.getMonth(), lastActivity.getDate());
                                    if (lastActivityDay.getTime() === today.getTime()) {
                                        // Already logged in today
                                        return [2 /*return*/, {
                                                currentStreak: currentStreak,
                                                longestStreak: xpData.longest_streak_days,
                                                xpGranted: 0,
                                            }];
                                    }
                                    yesterday = new Date(today);
                                    yesterday.setDate(yesterday.getDate() - 1);
                                    if (lastActivityDay.getTime() === yesterday.getTime()) {
                                        // Streak continues
                                        currentStreak += 1;
                                    }
                                    else {
                                        // Streak broken
                                        currentStreak = 1;
                                    }
                                }
                                else {
                                    // First login ever
                                    currentStreak = 1;
                                }
                                longestStreak = Math.max(currentStreak, xpData.longest_streak_days);
                                // Update streak
                                return [4 /*yield*/, trx
                                        .updateTable('customer_xp')
                                        .set({
                                        current_streak_days: currentStreak,
                                        longest_streak_days: longestStreak,
                                        last_activity_date: today,
                                        updated_at: (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('customer_user_id', '=', userId)
                                        .execute()];
                            case 2:
                                // Update streak
                                _a.sent();
                                dailyXP = exports.XP_REWARDS.daily_login;
                                return [4 /*yield*/, grantXP({
                                        userId: userId,
                                        amount: dailyXP,
                                        transactionType: XPTransactionType.DAILY_LOGIN,
                                        description: "G\u00FCnl\u00FCk giri\u015F bonusu (".concat(currentStreak, " g\u00FCn streak)"),
                                        metadata: { streak: currentStreak },
                                    })];
                            case 3:
                                _a.sent();
                                xpGranted += dailyXP;
                                if (!(currentStreak === 7)) return [3 /*break*/, 5];
                                return [4 /*yield*/, grantXP({
                                        userId: userId,
                                        amount: exports.XP_REWARDS.streak_bonus_7,
                                        transactionType: XPTransactionType.STREAK_BONUS,
                                        description: '7 gün streak bonusu! 🔥',
                                        metadata: { streak: 7 },
                                    })];
                            case 4:
                                _a.sent();
                                xpGranted += exports.XP_REWARDS.streak_bonus_7;
                                return [3 /*break*/, 7];
                            case 5:
                                if (!(currentStreak === 30)) return [3 /*break*/, 7];
                                return [4 /*yield*/, grantXP({
                                        userId: userId,
                                        amount: exports.XP_REWARDS.streak_bonus_30,
                                        transactionType: XPTransactionType.STREAK_BONUS,
                                        description: '30 gün streak bonusu! 🔥🔥🔥',
                                        metadata: { streak: 30 },
                                    })];
                            case 6:
                                _a.sent();
                                xpGranted += exports.XP_REWARDS.streak_bonus_30;
                                _a.label = 7;
                            case 7: return [2 /*return*/, {
                                    currentStreak: currentStreak,
                                    longestStreak: longestStreak,
                                    xpGranted: xpGranted,
                                }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Get user XP details
 */
function getUserXP(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var xpData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
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
                        .executeTakeFirst()];
                case 1:
                    xpData = _a.sent();
                    if (!xpData) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, {
                            xpPoints: xpData.xp_points,
                            level: xpData.level,
                            levelProgress: xpData.level_progress,
                            totalEarned: xpData.total_earned,
                            currentStreak: xpData.current_streak_days,
                            longestStreak: xpData.longest_streak_days,
                            lastActivityDate: xpData.last_activity_date,
                            nextLevelXP: xpData.next_level_xp,
                            achievementsCount: xpData.achievements_count,
                            levelName: exports.XP_LEVELS[xpData.level].name_tr,
                        }];
            }
        });
    });
}
/**
 * Get XP transaction history
 */
function getXPTransactions(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, limit, offset) {
        var transactions;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
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
                        .execute()];
                case 1:
                    transactions = _a.sent();
                    return [2 /*return*/, transactions];
            }
        });
    });
}
/**
 * Get XP leaderboard
 */
function getXPLeaderboard() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var leaderboard;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_xp as xp')
                        .innerJoin('customer_users as cu', 'cu.id', 'xp.customer_user_id')
                        .select([
                        'cu.id',
                        'cu.full_name as name',
                        'cu.username',
                        'xp.xp_points',
                        'xp.level',
                        'xp.current_streak_days',
                    ])
                        .where('cu.deleted_at', 'is', null)
                        .orderBy('xp.xp_points', 'desc')
                        .limit(limit)
                        .execute()];
                case 1:
                    leaderboard = _a.sent();
                    return [2 /*return*/, leaderboard.map(function (entry, index) { return ({
                            rank: index + 1,
                            userId: entry.id,
                            name: entry.name,
                            username: entry.username,
                            xpPoints: entry.xp_points,
                            level: entry.level,
                            streakDays: entry.current_streak_days,
                        }); })];
            }
        });
    });
}
exports.default = {
    grantXP: grantXP,
    getUserXP: getUserXP,
    getXPTransactions: getXPTransactions,
    updateLoginStreak: updateLoginStreak,
    getXPLeaderboard: getXPLeaderboard,
    calculateLevel: calculateLevel,
    calculateLevelProgress: calculateLevelProgress,
    getNextLevelXP: getNextLevelXP,
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;

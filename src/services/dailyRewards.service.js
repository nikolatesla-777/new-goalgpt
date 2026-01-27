"use strict";
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
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.getCurrentDayNumber = getCurrentDayNumber;
exports.getDailyRewardStatus = getDailyRewardStatus;
exports.claimDailyReward = claimDailyReward;
exports.getDailyRewardHistory = getDailyRewardHistory;
exports.getDailyRewardStats = getDailyRewardStats;
exports.getDailyRewardCalendar = getDailyRewardCalendar;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var xp_service_1 = require("./xp.service");
var credits_service_1 = require("./credits.service");
// Daily reward configuration
var DAILY_REWARDS = [
    { day: 1, credits: 10, xp: 10, type: 'credits' },
    { day: 2, credits: 15, xp: 15, type: 'credits' },
    { day: 3, credits: 20, xp: 20, type: 'credits' },
    { day: 4, credits: 25, xp: 25, type: 'credits' },
    { day: 5, credits: 30, xp: 30, type: 'credits' },
    { day: 6, credits: 40, xp: 40, type: 'credits' },
    { day: 7, credits: 100, xp: 50, type: 'special' }, // Jackpot day
];
/**
 * Get today's date at midnight (UTC)
 */
function getTodayMidnight() {
    var today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
}
/**
 * Calculate current day number in cycle (1-7)
 */
function getCurrentDayNumber(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var lastClaim, today, lastClaimDate, yesterday, nextDay;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_daily_rewards')
                        .select(['reward_date', 'day_number'])
                        .where('customer_user_id', '=', userId)
                        .orderBy('reward_date', 'desc')
                        .limit(1)
                        .executeTakeFirst()];
                case 1:
                    lastClaim = _a.sent();
                    if (!lastClaim) {
                        return [2 /*return*/, 1]; // First time claiming
                    }
                    today = getTodayMidnight();
                    lastClaimDate = new Date(lastClaim.reward_date);
                    lastClaimDate.setUTCHours(0, 0, 0, 0);
                    yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    if (lastClaimDate.getTime() === yesterday.getTime()) {
                        nextDay = lastClaim.day_number + 1;
                        return [2 /*return*/, nextDay > 7 ? 1 : nextDay]; // Reset to 1 after day 7
                    }
                    else if (lastClaimDate.getTime() < yesterday.getTime()) {
                        // Streak broken, reset to day 1
                        return [2 /*return*/, 1];
                    }
                    else {
                        // Last claim was today (should not happen, but handle gracefully)
                        return [2 /*return*/, lastClaim.day_number];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Get daily reward status for user
 */
function getDailyRewardStatus(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var today, todayClaim, claimedToday, lastClaim, currentDay, streak, lastClaimDate, daysSinceLastClaim, nextReward;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = getTodayMidnight();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_daily_rewards')
                            .select(['reward_date', 'day_number'])
                            .where('customer_user_id', '=', userId)
                            .where('reward_date', '=', today)
                            .executeTakeFirst()];
                case 1:
                    todayClaim = _a.sent();
                    claimedToday = !!todayClaim;
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_daily_rewards')
                            .select(['reward_date', 'day_number'])
                            .where('customer_user_id', '=', userId)
                            .orderBy('reward_date', 'desc')
                            .limit(1)
                            .executeTakeFirst()];
                case 2:
                    lastClaim = _a.sent();
                    return [4 /*yield*/, getCurrentDayNumber(userId)];
                case 3:
                    currentDay = _a.sent();
                    streak = 0;
                    if (lastClaim) {
                        lastClaimDate = new Date(lastClaim.reward_date);
                        lastClaimDate.setUTCHours(0, 0, 0, 0);
                        daysSinceLastClaim = Math.floor((today.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysSinceLastClaim === 0) {
                            // Claimed today
                            streak = lastClaim.day_number;
                        }
                        else if (daysSinceLastClaim === 1) {
                            // Claimed yesterday
                            streak = lastClaim.day_number;
                        }
                        else {
                            // Streak broken
                            streak = 0;
                        }
                    }
                    nextReward = DAILY_REWARDS[currentDay - 1];
                    return [2 /*return*/, {
                            canClaim: !claimedToday,
                            currentDay: currentDay,
                            nextReward: {
                                day: nextReward.day,
                                credits: nextReward.credits,
                                xp: nextReward.xp,
                                type: nextReward.type,
                            },
                            lastClaimDate: (lastClaim === null || lastClaim === void 0 ? void 0 : lastClaim.reward_date) || null,
                            streak: streak,
                            claimedToday: claimedToday,
                        }];
            }
        });
    });
}
/**
 * Claim daily reward
 */
function claimDailyReward(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var today, todayClaim, currentDay, reward, claim, specialMessage;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                today = getTodayMidnight();
                                return [4 /*yield*/, trx
                                        .selectFrom('customer_daily_rewards')
                                        .select('id')
                                        .where('customer_user_id', '=', userId)
                                        .where('reward_date', '=', today)
                                        .executeTakeFirst()];
                            case 1:
                                todayClaim = _a.sent();
                                if (todayClaim) {
                                    throw new Error('Daily reward already claimed today');
                                }
                                return [4 /*yield*/, getCurrentDayNumber(userId)];
                            case 2:
                                currentDay = _a.sent();
                                reward = DAILY_REWARDS[currentDay - 1];
                                return [4 /*yield*/, trx
                                        .insertInto('customer_daily_rewards')
                                        .values({
                                        customer_user_id: userId,
                                        reward_date: today,
                                        day_number: currentDay,
                                        reward_type: reward.type,
                                        reward_amount: reward.credits,
                                        claimed_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .returning(['id', 'day_number', 'reward_type', 'reward_amount'])
                                        .executeTakeFirstOrThrow()];
                            case 3:
                                claim = _a.sent();
                                // Grant credits
                                return [4 /*yield*/, (0, credits_service_1.grantCredits)({
                                        userId: userId,
                                        amount: reward.credits,
                                        transactionType: 'daily_reward',
                                        description: "G\u00FCnl\u00FCk \u00F6d\u00FCl (G\u00FCn ".concat(currentDay, ")"),
                                        referenceId: claim.id,
                                        referenceType: 'daily_reward',
                                    })];
                            case 4:
                                // Grant credits
                                _a.sent();
                                // Grant XP
                                return [4 /*yield*/, (0, xp_service_1.grantXP)({
                                        userId: userId,
                                        amount: reward.xp,
                                        transactionType: xp_service_1.XPTransactionType.DAILY_LOGIN,
                                        description: "G\u00FCnl\u00FCk \u00F6d\u00FCl (G\u00FCn ".concat(currentDay, ")"),
                                        referenceId: claim.id,
                                        referenceType: 'daily_reward',
                                    })];
                            case 5:
                                // Grant XP
                                _a.sent();
                                specialMessage = '';
                                if (currentDay === 7) {
                                    specialMessage = ' 🎉 JACKPOT! Haftalık seriyi tamamladın!';
                                    // Could add additional special reward here (e.g., VIP day)
                                    // For now, the 100 credits + 50 XP is the jackpot
                                }
                                return [2 /*return*/, {
                                        success: true,
                                        reward: {
                                            day: currentDay,
                                            credits: reward.credits,
                                            xp: reward.xp,
                                            type: reward.type,
                                        },
                                        message: "G\u00FCnl\u00FCk \u00F6d\u00FCl al\u0131nd\u0131! ".concat(reward.credits, " kredi + ").concat(reward.xp, " XP").concat(specialMessage),
                                    }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Get daily reward claim history
 */
function getDailyRewardHistory(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, limit) {
        var history;
        if (limit === void 0) { limit = 30; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_daily_rewards')
                        .selectAll()
                        .where('customer_user_id', '=', userId)
                        .orderBy('reward_date', 'desc')
                        .limit(limit)
                        .execute()];
                case 1:
                    history = _a.sent();
                    return [2 /*return*/, history];
            }
        });
    });
}
/**
 * Get daily reward statistics (all users)
 */
function getDailyRewardStats() {
    return __awaiter(this, void 0, void 0, function () {
        var today, stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = getTodayMidnight();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_daily_rewards')
                            .select([
                            (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["COUNT(DISTINCT customer_user_id)"], ["COUNT(DISTINCT customer_user_id)"]))).as('total_claimers'),
                            (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["COUNT(*) FILTER (WHERE reward_date = ", ")"], ["COUNT(*) FILTER (WHERE reward_date = ", ")"])), today).as('claimed_today'),
                            (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["COUNT(*) FILTER (WHERE day_number = 7)"], ["COUNT(*) FILTER (WHERE day_number = 7)"]))).as('jackpot_claims'),
                            (0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["SUM(reward_amount)"], ["SUM(reward_amount)"]))).as('total_credits_distributed'),
                        ])
                            .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, {
                            totalClaimers: Number((stats === null || stats === void 0 ? void 0 : stats.total_claimers) || 0),
                            claimedToday: Number((stats === null || stats === void 0 ? void 0 : stats.claimed_today) || 0),
                            jackpotClaims: Number((stats === null || stats === void 0 ? void 0 : stats.jackpot_claims) || 0),
                            totalCreditsDistributed: Number((stats === null || stats === void 0 ? void 0 : stats.total_credits_distributed) || 0),
                        }];
            }
        });
    });
}
/**
 * Get daily reward calendar (7-day preview)
 */
function getDailyRewardCalendar() {
    return DAILY_REWARDS.map(function (reward) { return ({
        day: reward.day,
        credits: reward.credits,
        xp: reward.xp,
        type: reward.type,
        isJackpot: reward.day === 7,
    }); });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;

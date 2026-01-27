"use strict";
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
exports.MAX_DAILY_CREDITS_FROM_ADS = exports.DAILY_AD_LIMIT = exports.CREDIT_COSTS = exports.CREDIT_REWARDS = exports.CreditTransactionType = void 0;
exports.grantCredits = grantCredits;
exports.spendCredits = spendCredits;
exports.getUserCredits = getUserCredits;
exports.getCreditTransactions = getCreditTransactions;
exports.processAdReward = processAdReward;
exports.purchaseVIPPrediction = purchaseVIPPrediction;
exports.refundCredits = refundCredits;
exports.getDailyCreditsStats = getDailyCreditsStats;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var logger_1 = require("../utils/logger");
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
function grantCredits(params) {
    return __awaiter(this, void 0, void 0, function () {
        var userId, amount, transactionType, description, referenceId, referenceType, _a, metadata;
        var _this = this;
        return __generator(this, function (_b) {
            userId = params.userId, amount = params.amount, transactionType = params.transactionType, description = params.description, referenceId = params.referenceId, referenceType = params.referenceType, _a = params.metadata, metadata = _a === void 0 ? {} : _a;
            if (amount <= 0) {
                throw new Error('Credit amount must be positive');
            }
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var currentCredits, oldBalance, newBalance, transaction;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('customer_credits')
                                    .select(['balance', 'lifetime_earned'])
                                    .where('customer_user_id', '=', userId)
                                    .executeTakeFirst()];
                            case 1:
                                currentCredits = _a.sent();
                                if (!currentCredits) {
                                    throw new Error('User credits record not found');
                                }
                                oldBalance = currentCredits.balance;
                                newBalance = oldBalance + amount;
                                // 2. Update balance
                                return [4 /*yield*/, trx
                                        .updateTable('customer_credits')
                                        .set({
                                        balance: newBalance,
                                        lifetime_earned: currentCredits.lifetime_earned + amount,
                                        updated_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('customer_user_id', '=', userId)
                                        .execute()];
                            case 2:
                                // 2. Update balance
                                _a.sent();
                                return [4 /*yield*/, trx
                                        .insertInto('customer_credit_transactions')
                                        .values({
                                        customer_user_id: userId,
                                        amount: amount,
                                        transaction_type: transactionType,
                                        description: description || null,
                                        reference_id: referenceId || null,
                                        reference_type: referenceType || null,
                                        balance_before: oldBalance,
                                        balance_after: newBalance,
                                        metadata: JSON.stringify(metadata),
                                        created_at: (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .returning('id')
                                        .executeTakeFirstOrThrow()];
                            case 3:
                                transaction = _a.sent();
                                logger_1.logger.info("Granted ".concat(amount, " credits to user ").concat(userId), {
                                    type: transactionType,
                                    oldBalance: oldBalance,
                                    newBalance: newBalance,
                                });
                                return [2 /*return*/, {
                                        success: true,
                                        oldBalance: oldBalance,
                                        newBalance: newBalance,
                                        transactionId: transaction.id,
                                    }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Spend credits (with balance validation)
 */
function spendCredits(params) {
    return __awaiter(this, void 0, void 0, function () {
        var userId, amount, transactionType, description, referenceId, referenceType, _a, metadata;
        var _this = this;
        return __generator(this, function (_b) {
            userId = params.userId, amount = params.amount, transactionType = params.transactionType, description = params.description, referenceId = params.referenceId, referenceType = params.referenceType, _a = params.metadata, metadata = _a === void 0 ? {} : _a;
            if (amount <= 0) {
                throw new Error('Credit amount must be positive');
            }
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var currentCredits, oldBalance, newBalance, transaction;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('customer_credits')
                                    .select(['balance', 'lifetime_spent'])
                                    .where('customer_user_id', '=', userId)
                                    .executeTakeFirst()];
                            case 1:
                                currentCredits = _a.sent();
                                if (!currentCredits) {
                                    throw new Error('User credits record not found');
                                }
                                oldBalance = currentCredits.balance;
                                // 2. Validate sufficient balance
                                if (oldBalance < amount) {
                                    throw new Error("Insufficient credits. Required: ".concat(amount, ", Available: ").concat(oldBalance));
                                }
                                newBalance = oldBalance - amount;
                                // 3. Update balance
                                return [4 /*yield*/, trx
                                        .updateTable('customer_credits')
                                        .set({
                                        balance: newBalance,
                                        lifetime_spent: currentCredits.lifetime_spent + amount,
                                        updated_at: (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('customer_user_id', '=', userId)
                                        .execute()];
                            case 2:
                                // 3. Update balance
                                _a.sent();
                                return [4 /*yield*/, trx
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
                                        created_at: (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .returning('id')
                                        .executeTakeFirstOrThrow()];
                            case 3:
                                transaction = _a.sent();
                                logger_1.logger.info("User ".concat(userId, " spent ").concat(amount, " credits"), {
                                    type: transactionType,
                                    oldBalance: oldBalance,
                                    newBalance: newBalance,
                                });
                                return [2 /*return*/, {
                                        success: true,
                                        oldBalance: oldBalance,
                                        newBalance: newBalance,
                                        transactionId: transaction.id,
                                    }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Get user credits balance
 */
function getUserCredits(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var creditsData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_credits')
                        .select(['balance', 'lifetime_earned', 'lifetime_spent'])
                        .where('customer_user_id', '=', userId)
                        .executeTakeFirst()];
                case 1:
                    creditsData = _a.sent();
                    if (!creditsData) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, {
                            balance: creditsData.balance,
                            lifetimeEarned: creditsData.lifetime_earned,
                            lifetimeSpent: creditsData.lifetime_spent,
                        }];
            }
        });
    });
}
/**
 * Get credit transaction history
 */
function getCreditTransactions(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, limit, offset) {
        var transactions;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
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
                        .execute()];
                case 1:
                    transactions = _a.sent();
                    return [2 /*return*/, transactions];
            }
        });
    });
}
/**
 * Process ad reward (with fraud prevention)
 */
function processAdReward(userId, adNetwork, adUnitId, adType, deviceId, ipAddress, userAgent) {
    return __awaiter(this, void 0, void 0, function () {
        var today, todayAds, adsWatchedToday;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_ad_views')
                            .select((0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('count'))
                            .where('customer_user_id', '=', userId)
                            .where('completed_at', '>=', today)
                            .where('reward_granted', '=', true)
                            .executeTakeFirst()];
                case 1:
                    todayAds = _a.sent();
                    adsWatchedToday = Number((todayAds === null || todayAds === void 0 ? void 0 : todayAds.count) || 0);
                    if (adsWatchedToday >= exports.DAILY_AD_LIMIT) {
                        return [2 /*return*/, {
                                success: false,
                                credits: 0,
                                message: "G\u00FCnl\u00FCk reklam limiti a\u015F\u0131ld\u0131 (".concat(exports.DAILY_AD_LIMIT, "/").concat(exports.DAILY_AD_LIMIT, ")"),
                            }];
                    }
                    // 2. Log ad view
                    return [4 /*yield*/, kysely_1.db
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
                            completed_at: (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                            metadata: JSON.stringify({ daily_count: adsWatchedToday + 1 }),
                        })
                            .execute()];
                case 2:
                    // 2. Log ad view
                    _a.sent();
                    // 3. Grant credits
                    return [4 /*yield*/, grantCredits({
                            userId: userId,
                            amount: exports.CREDIT_REWARDS.ad_reward,
                            transactionType: CreditTransactionType.AD_REWARD,
                            description: "Reklam izleme \u00F6d\u00FCl\u00FC (".concat(adsWatchedToday + 1, "/").concat(exports.DAILY_AD_LIMIT, ")"),
                            referenceType: 'ad_view',
                            metadata: {
                                ad_network: adNetwork,
                                ad_type: adType,
                                daily_count: adsWatchedToday + 1,
                            },
                        })];
                case 3:
                    // 3. Grant credits
                    _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            credits: exports.CREDIT_REWARDS.ad_reward,
                            message: "".concat(exports.CREDIT_REWARDS.ad_reward, " kredi kazand\u0131n! (").concat(adsWatchedToday + 1, "/").concat(exports.DAILY_AD_LIMIT, ")"),
                        }];
            }
        });
    });
}
/**
 * Purchase VIP prediction with credits
 */
function purchaseVIPPrediction(userId, predictionId) {
    return __awaiter(this, void 0, void 0, function () {
        var cost, existingPurchase;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cost = exports.CREDIT_COSTS.vip_prediction;
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('ts_prediction_mapped')
                            .select('id')
                            .where('id', '=', predictionId)
                            .where('purchased_by_user_id', '=', userId)
                            .executeTakeFirst()];
                case 1:
                    existingPurchase = _a.sent();
                    if (existingPurchase) {
                        throw new Error('Bu tahmin zaten satın alındı');
                    }
                    // Spend credits
                    return [4 /*yield*/, spendCredits({
                            userId: userId,
                            amount: cost,
                            transactionType: CreditTransactionType.PREDICTION_PURCHASE,
                            description: "VIP tahmin sat\u0131n al\u0131nd\u0131",
                            referenceId: predictionId,
                            referenceType: 'prediction',
                            metadata: { prediction_id: predictionId },
                        })];
                case 2:
                    // Spend credits
                    _a.sent();
                    // Mark prediction as purchased
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('ts_prediction_mapped')
                            .set({
                            credit_cost: cost,
                            purchased_by_user_id: userId,
                            purchased_at: (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .where('id', '=', predictionId)
                            .execute()];
                case 3:
                    // Mark prediction as purchased
                    _a.sent();
                    logger_1.logger.info("User ".concat(userId, " purchased VIP prediction ").concat(predictionId, " for ").concat(cost, " credits"));
                    return [2 /*return*/, {
                            success: true,
                            creditsSpent: cost,
                        }];
            }
        });
    });
}
/**
 * Refund credits (e.g., for cancelled purchase)
 */
function refundCredits(userId, amount, reason, referenceId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, grantCredits({
                    userId: userId,
                    amount: amount,
                    transactionType: CreditTransactionType.REFUND,
                    description: "\u0130ade: ".concat(reason),
                    referenceId: referenceId,
                    referenceType: 'refund',
                    metadata: { reason: reason },
                })];
        });
    });
}
/**
 * Get total credits earned/spent today
 */
function getDailyCreditsStats(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var today, stats, adsToday;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_credit_transactions')
                            .select([
                            (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)"], ["COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)"]))).as('earned_today'),
                            (0, kysely_2.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)"], ["COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)"]))).as('spent_today'),
                        ])
                            .where('customer_user_id', '=', userId)
                            .where('created_at', '>=', today)
                            .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_ad_views')
                            .select((0, kysely_2.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('count'))
                            .where('customer_user_id', '=', userId)
                            .where('completed_at', '>=', today)
                            .where('reward_granted', '=', true)
                            .executeTakeFirst()];
                case 2:
                    adsToday = _a.sent();
                    return [2 /*return*/, {
                            earnedToday: Number((stats === null || stats === void 0 ? void 0 : stats.earned_today) || 0),
                            spentToday: Number((stats === null || stats === void 0 ? void 0 : stats.spent_today) || 0),
                            adsWatchedToday: Number((adsToday === null || adsToday === void 0 ? void 0 : adsToday.count) || 0),
                            adsRemainingToday: Math.max(0, exports.DAILY_AD_LIMIT - Number((adsToday === null || adsToday === void 0 ? void 0 : adsToday.count) || 0)),
                        }];
            }
        });
    });
}
exports.default = {
    grantCredits: grantCredits,
    spendCredits: spendCredits,
    getUserCredits: getUserCredits,
    getCreditTransactions: getCreditTransactions,
    processAdReward: processAdReward,
    purchaseVIPPrediction: purchaseVIPPrediction,
    refundCredits: refundCredits,
    getDailyCreditsStats: getDailyCreditsStats,
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;

"use strict";
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
exports.generateReferralCode = generateReferralCode;
exports.getUserReferralCode = getUserReferralCode;
exports.applyReferralCode = applyReferralCode;
exports.processReferralTier2 = processReferralTier2;
exports.processReferralTier3 = processReferralTier3;
exports.getReferralStats = getReferralStats;
exports.getUserReferrals = getUserReferrals;
exports.getReferralLeaderboard = getReferralLeaderboard;
exports.validateReferralCode = validateReferralCode;
exports.expireOldReferrals = expireOldReferrals;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var xp_service_1 = require("./xp.service");
var credits_service_1 = require("./credits.service");
// Reward configuration
var REFERRAL_REWARDS = {
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
function generateReferralCode() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = 'GOAL-';
    for (var i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
/**
 * Get or create user's referral code
 */
function getUserReferralCode(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var user, newCode, isUnique, attempts, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_users')
                        .select('referral_code')
                        .where('id', '=', userId)
                        .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    if (user === null || user === void 0 ? void 0 : user.referral_code) {
                        return [2 /*return*/, user.referral_code];
                    }
                    isUnique = false;
                    attempts = 0;
                    _a.label = 2;
                case 2:
                    if (!(!isUnique && attempts < 10)) return [3 /*break*/, 6];
                    newCode = generateReferralCode();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_users')
                            .select('id')
                            .where('referral_code', '=', newCode)
                            .executeTakeFirst()];
                case 3:
                    existing = _a.sent();
                    if (!!existing) return [3 /*break*/, 5];
                    isUnique = true;
                    // Update user with new code
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('customer_users')
                            .set({ referral_code: newCode })
                            .where('id', '=', userId)
                            .execute()];
                case 4:
                    // Update user with new code
                    _a.sent();
                    return [2 /*return*/, newCode];
                case 5:
                    attempts++;
                    return [3 /*break*/, 2];
                case 6: throw new Error('Failed to generate unique referral code');
            }
        });
    });
}
/**
 * Apply referral code during signup
 * Creates Tier 1 referral record
 */
function applyReferralCode(referredUserId, referralCode) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var referrer, existingReferral, referral;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('customer_users')
                                    .select(['id', 'referral_code'])
                                    .where('referral_code', '=', referralCode)
                                    .where('deleted_at', 'is', null)
                                    .executeTakeFirst()];
                            case 1:
                                referrer = _a.sent();
                                if (!referrer) {
                                    throw new Error('Invalid referral code');
                                }
                                // 2. Prevent self-referral
                                if (referrer.id === referredUserId) {
                                    throw new Error('Cannot refer yourself');
                                }
                                return [4 /*yield*/, trx
                                        .selectFrom('referrals')
                                        .select('id')
                                        .where('referred_user_id', '=', referredUserId)
                                        .executeTakeFirst()];
                            case 2:
                                existingReferral = _a.sent();
                                if (existingReferral) {
                                    throw new Error('User already has a referral');
                                }
                                return [4 /*yield*/, trx
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
                                        created_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        expires_at: (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["NOW() + INTERVAL '30 days'"], ["NOW() + INTERVAL '30 days'"]))),
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
                                        .executeTakeFirstOrThrow()];
                            case 3:
                                referral = _a.sent();
                                // 5. Grant Tier 1 rewards to referrer
                                return [4 /*yield*/, (0, xp_service_1.grantXP)({
                                        userId: referrer.id,
                                        amount: REFERRAL_REWARDS.tier1.referrer_xp,
                                        transactionType: xp_service_1.XPTransactionType.REFERRAL_SIGNUP,
                                        description: "Arkada\u015F\u0131n\u0131 davet ettin! (".concat(referralCode, ")"),
                                        referenceId: referral.id,
                                        referenceType: 'referral',
                                    })];
                            case 4:
                                // 5. Grant Tier 1 rewards to referrer
                                _a.sent();
                                return [4 /*yield*/, (0, credits_service_1.grantCredits)({
                                        userId: referrer.id,
                                        amount: REFERRAL_REWARDS.tier1.referrer_credits,
                                        transactionType: 'referral_bonus',
                                        description: "Referral Tier 1: Arkada\u015F\u0131n kay\u0131t oldu",
                                        referenceId: referral.id,
                                        referenceType: 'referral',
                                    })];
                            case 5:
                                _a.sent();
                                return [2 /*return*/, { success: true, referral: referral }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Process Tier 2 reward (first login)
 * Called after referred user's first successful login
 */
function processReferralTier2(referredUserId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var referral, checkAndUnlockBadges, referrerReferralCount;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('referrals')
                                    .selectAll()
                                    .where('referred_user_id', '=', referredUserId)
                                    .where('status', '=', 'pending')
                                    .where('tier', '=', 1)
                                    .where('expires_at', '>', new Date())
                                    .executeTakeFirst()];
                            case 1:
                                referral = _a.sent();
                                if (!referral) {
                                    return [2 /*return*/, false]; // No active referral found
                                }
                                // 2. Update to Tier 2
                                return [4 /*yield*/, trx
                                        .updateTable('referrals')
                                        .set({
                                        status: 'completed',
                                        tier: 2,
                                        referrer_reward_credits: (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["referrer_reward_credits + ", ""], ["referrer_reward_credits + ", ""])), REFERRAL_REWARDS.tier2.referrer_credits),
                                        referred_reward_credits: (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["referred_reward_credits + ", ""], ["referred_reward_credits + ", ""])), REFERRAL_REWARDS.tier2.referred_credits),
                                    })
                                        .where('id', '=', referral.id)
                                        .execute()];
                            case 2:
                                // 2. Update to Tier 2
                                _a.sent();
                                // 3. Grant Tier 2 rewards
                                return [4 /*yield*/, (0, credits_service_1.grantCredits)({
                                        userId: referral.referrer_user_id,
                                        amount: REFERRAL_REWARDS.tier2.referrer_credits,
                                        transactionType: 'referral_bonus',
                                        description: "Referral Tier 2: Arkada\u015F\u0131n giri\u015F yapt\u0131",
                                        referenceId: referral.id,
                                        referenceType: 'referral',
                                    })];
                            case 3:
                                // 3. Grant Tier 2 rewards
                                _a.sent();
                                return [4 /*yield*/, (0, credits_service_1.grantCredits)({
                                        userId: referredUserId,
                                        amount: REFERRAL_REWARDS.tier2.referred_credits,
                                        transactionType: 'referral_bonus',
                                        description: "Referral bonusu: \u0130lk giri\u015F",
                                        referenceId: referral.id,
                                        referenceType: 'referral',
                                    })];
                            case 4:
                                _a.sent();
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./badges.service')); })];
                            case 5:
                                checkAndUnlockBadges = (_a.sent()).checkAndUnlockBadges;
                                return [4 /*yield*/, trx
                                        .selectFrom('referrals')
                                        .select((0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('count'))
                                        .where('referrer_user_id', '=', referral.referrer_user_id)
                                        .where('tier', '>=', 2)
                                        .executeTakeFirst()];
                            case 6:
                                referrerReferralCount = _a.sent();
                                return [4 /*yield*/, checkAndUnlockBadges(referral.referrer_user_id, 'referrals', Number((referrerReferralCount === null || referrerReferralCount === void 0 ? void 0 : referrerReferralCount.count) || 0))];
                            case 7:
                                _a.sent();
                                return [2 /*return*/, true];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Process Tier 3 reward (subscription purchase)
 * Called after referred user purchases subscription
 */
function processReferralTier3(referredUserId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var referral;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('referrals')
                                    .selectAll()
                                    .where('referred_user_id', '=', referredUserId)
                                    .where('status', '=', 'completed')
                                    .where('tier', '=', 2)
                                    .where('expires_at', '>', new Date())
                                    .executeTakeFirst()];
                            case 1:
                                referral = _a.sent();
                                if (!referral) {
                                    return [2 /*return*/, false]; // No active Tier 2 referral found
                                }
                                // 2. Update to Tier 3
                                return [4 /*yield*/, trx
                                        .updateTable('referrals')
                                        .set({
                                        status: 'rewarded',
                                        tier: 3,
                                        referrer_reward_credits: (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["referrer_reward_credits + ", ""], ["referrer_reward_credits + ", ""])), REFERRAL_REWARDS.tier3.referrer_credits),
                                        referred_subscribed_at: (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        reward_claimed_at: (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('id', '=', referral.id)
                                        .execute()];
                            case 2:
                                // 2. Update to Tier 3
                                _a.sent();
                                // 3. Grant Tier 3 rewards
                                return [4 /*yield*/, (0, credits_service_1.grantCredits)({
                                        userId: referral.referrer_user_id,
                                        amount: REFERRAL_REWARDS.tier3.referrer_credits,
                                        transactionType: 'referral_bonus',
                                        description: "Referral Tier 3: Arkada\u015F\u0131n abone oldu! \uD83C\uDF89",
                                        referenceId: referral.id,
                                        referenceType: 'referral',
                                    })];
                            case 3:
                                // 3. Grant Tier 3 rewards
                                _a.sent();
                                return [2 /*return*/, true];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Get user's referral statistics
 */
function getReferralStats(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('referrals')
                        .select([
                        (0, kysely_2.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('total_referrals'),
                        (0, kysely_2.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["COUNT(*) FILTER (WHERE tier >= 2)"], ["COUNT(*) FILTER (WHERE tier >= 2)"]))).as('active_referrals'),
                        (0, kysely_2.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["COUNT(*) FILTER (WHERE tier = 3)"], ["COUNT(*) FILTER (WHERE tier = 3)"]))).as('subscribed_referrals'),
                        (0, kysely_2.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["SUM(referrer_reward_xp)"], ["SUM(referrer_reward_xp)"]))).as('total_xp_earned'),
                        (0, kysely_2.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["SUM(referrer_reward_credits)"], ["SUM(referrer_reward_credits)"]))).as('total_credits_earned'),
                    ])
                        .where('referrer_user_id', '=', userId)
                        .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, {
                            totalReferrals: Number((stats === null || stats === void 0 ? void 0 : stats.total_referrals) || 0),
                            activeReferrals: Number((stats === null || stats === void 0 ? void 0 : stats.active_referrals) || 0),
                            subscribedReferrals: Number((stats === null || stats === void 0 ? void 0 : stats.subscribed_referrals) || 0),
                            totalXPEarned: Number((stats === null || stats === void 0 ? void 0 : stats.total_xp_earned) || 0),
                            totalCreditsEarned: Number((stats === null || stats === void 0 ? void 0 : stats.total_credits_earned) || 0),
                        }];
            }
        });
    });
}
/**
 * Get user's referral list
 */
function getUserReferrals(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, limit, offset) {
        var referrals;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
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
                        .execute()];
                case 1:
                    referrals = _a.sent();
                    return [2 /*return*/, referrals.map(function (ref) { return ({
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
                        }); })];
            }
        });
    });
}
/**
 * Get referral leaderboard (top referrers)
 */
function getReferralLeaderboard() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var leaderboard;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('referrals as r')
                        .innerJoin('customer_users as cu', 'cu.id', 'r.referrer_user_id')
                        .select([
                        'cu.id',
                        'cu.full_name as name',
                        'cu.username',
                        (0, kysely_2.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["COUNT(r.id)"], ["COUNT(r.id)"]))).as('total_referrals'),
                        (0, kysely_2.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["COUNT(r.id) FILTER (WHERE r.tier >= 2)"], ["COUNT(r.id) FILTER (WHERE r.tier >= 2)"]))).as('active_referrals'),
                        (0, kysely_2.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["COUNT(r.id) FILTER (WHERE r.tier = 3)"], ["COUNT(r.id) FILTER (WHERE r.tier = 3)"]))).as('subscribed_referrals'),
                        (0, kysely_2.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["SUM(r.referrer_reward_credits)"], ["SUM(r.referrer_reward_credits)"]))).as('total_credits_earned'),
                    ])
                        .where('cu.deleted_at', 'is', null)
                        .groupBy(['cu.id', 'cu.full_name', 'cu.username'])
                        .orderBy((0, kysely_2.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["COUNT(r.id) FILTER (WHERE r.tier = 3)"], ["COUNT(r.id) FILTER (WHERE r.tier = 3)"]))), 'desc')
                        .orderBy((0, kysely_2.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["COUNT(r.id)"], ["COUNT(r.id)"]))), 'desc')
                        .limit(limit)
                        .execute()];
                case 1:
                    leaderboard = _a.sent();
                    return [2 /*return*/, leaderboard.map(function (entry, index) { return ({
                            rank: index + 1,
                            userId: entry.id,
                            name: entry.name,
                            username: entry.username,
                            totalReferrals: Number(entry.total_referrals),
                            activeReferrals: Number(entry.active_referrals),
                            subscribedReferrals: Number(entry.subscribed_referrals),
                            totalCreditsEarned: Number(entry.total_credits_earned),
                        }); })];
            }
        });
    });
}
/**
 * Validate referral code
 */
function validateReferralCode(code) {
    return __awaiter(this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_users')
                        .select('id')
                        .where('referral_code', '=', code)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, {
                            valid: !!user,
                            userId: user === null || user === void 0 ? void 0 : user.id,
                        }];
            }
        });
    });
}
/**
 * Expire old pending referrals (cron job)
 */
function expireOldReferrals() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('referrals')
                        .set({ status: 'expired' })
                        .where('status', '=', 'pending')
                        .where('expires_at', '<', new Date())
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, Number(result.numUpdatedRows || 0)];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19;

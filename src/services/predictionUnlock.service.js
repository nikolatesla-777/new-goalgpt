"use strict";
/**
 * Prediction Unlock Service
 *
 * Handles credit-based prediction unlocking for FREE users
 * - Check if user has unlocked a prediction
 * - Unlock prediction with credits
 * - Get user's unlocked predictions
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNLOCK_COST = void 0;
exports.hasUnlockedPrediction = hasUnlockedPrediction;
exports.isUserVip = isUserVip;
exports.canAccessPrediction = canAccessPrediction;
exports.unlockPrediction = unlockPrediction;
exports.getUserUnlockedPredictions = getUserUnlockedPredictions;
exports.getUserUnlockStats = getUserUnlockStats;
exports.getUnlockedPredictionIds = getUnlockedPredictionIds;
var kysely_1 = require("../database/kysely");
var credits_service_1 = __importDefault(require("./credits.service"));
var kysely_2 = require("kysely");
// ============================================================================
// CONSTANTS
// ============================================================================
exports.UNLOCK_COST = 50; // Credits required to unlock a prediction
// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================
/**
 * Check if user has unlocked a specific prediction
 */
function hasUnlockedPrediction(userId, predictionId) {
    return __awaiter(this, void 0, void 0, function () {
        var unlock;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_prediction_unlocks')
                        .select('id')
                        .where('customer_user_id', '=', userId)
                        .where('prediction_id', '=', predictionId)
                        .executeTakeFirst()];
                case 1:
                    unlock = _a.sent();
                    return [2 /*return*/, !!unlock];
            }
        });
    });
}
/**
 * Check if user is VIP (has active subscription)
 */
function isUserVip(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_users')
                        .select('is_vip')
                        .where('id', '=', userId)
                        .executeTakeFirst()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, (user === null || user === void 0 ? void 0 : user.is_vip) === true];
            }
        });
    });
}
/**
 * Check if user can access a prediction (VIP or unlocked)
 */
function canAccessPrediction(userId, predictionId) {
    return __awaiter(this, void 0, void 0, function () {
        var isVip;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, isUserVip(userId)];
                case 1:
                    isVip = _a.sent();
                    if (isVip)
                        return [2 /*return*/, true];
                    // Check if user has unlocked this prediction
                    return [2 /*return*/, hasUnlockedPrediction(userId, predictionId)];
            }
        });
    });
}
/**
 * Unlock a prediction using credits
 */
function unlockPrediction(userId, predictionId) {
    return __awaiter(this, void 0, void 0, function () {
        var alreadyUnlocked, isVip, creditsData, balance, spendResult, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, hasUnlockedPrediction(userId, predictionId)];
                case 1:
                    alreadyUnlocked = _a.sent();
                    if (alreadyUnlocked) {
                        return [2 /*return*/, {
                                success: true,
                                message: 'Bu tahmin zaten açık',
                            }];
                    }
                    return [4 /*yield*/, isUserVip(userId)];
                case 2:
                    isVip = _a.sent();
                    if (isVip) {
                        return [2 /*return*/, {
                                success: true,
                                message: 'VIP kullanıcılar tüm tahminlere erişebilir',
                            }];
                    }
                    return [4 /*yield*/, credits_service_1.default.getUserCredits(userId)];
                case 3:
                    creditsData = _a.sent();
                    balance = (creditsData === null || creditsData === void 0 ? void 0 : creditsData.balance) || 0;
                    if (balance < exports.UNLOCK_COST) {
                        return [2 /*return*/, {
                                success: false,
                                message: "Yetersiz kredi. ".concat(exports.UNLOCK_COST, " kredi gerekli, mevcut: ").concat(balance),
                                error: 'INSUFFICIENT_CREDITS',
                                newBalance: balance,
                            }];
                    }
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 7, , 8]);
                    return [4 /*yield*/, credits_service_1.default.spendCredits({
                            userId: userId,
                            amount: exports.UNLOCK_COST,
                            transactionType: 'prediction_unlock',
                            referenceId: predictionId,
                            description: "Tahmin kilidi a\u00E7ma: ".concat(predictionId),
                        })];
                case 5:
                    spendResult = _a.sent();
                    if (!spendResult.success) {
                        return [2 /*return*/, {
                                success: false,
                                message: 'Kredi harcama işlemi başarısız',
                                error: 'SPEND_FAILED',
                            }];
                    }
                    // Record the unlock
                    return [4 /*yield*/, kysely_1.db
                            .insertInto('customer_prediction_unlocks')
                            .values({
                            customer_user_id: userId,
                            prediction_id: predictionId,
                            credits_spent: exports.UNLOCK_COST,
                            unlocked_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .execute()];
                case 6:
                    // Record the unlock
                    _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            message: 'Tahmin başarıyla açıldı!',
                            newBalance: spendResult.newBalance,
                        }];
                case 7:
                    error_1 = _a.sent();
                    // Handle duplicate key error (race condition)
                    if (error_1.code === '23505') {
                        return [2 /*return*/, {
                                success: true,
                                message: 'Bu tahmin zaten açık',
                            }];
                    }
                    throw error_1;
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get all predictions unlocked by a user
 */
function getUserUnlockedPredictions(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var unlocks;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_prediction_unlocks')
                        .select('prediction_id')
                        .where('customer_user_id', '=', userId)
                        .execute()];
                case 1:
                    unlocks = _a.sent();
                    return [2 /*return*/, unlocks.map(function (u) { return u.prediction_id; })];
            }
        });
    });
}
/**
 * Get unlock statistics for a user
 */
function getUserUnlockStats(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('customer_prediction_unlocks')
                        .select([
                        (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('total_unlocked'),
                        (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["COALESCE(SUM(credits_spent), 0)"], ["COALESCE(SUM(credits_spent), 0)"]))).as('total_credits_spent'),
                    ])
                        .where('customer_user_id', '=', userId)
                        .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, {
                            totalUnlocked: Number((stats === null || stats === void 0 ? void 0 : stats.total_unlocked) || 0),
                            totalCreditsSpent: Number((stats === null || stats === void 0 ? void 0 : stats.total_credits_spent) || 0),
                        }];
            }
        });
    });
}
/**
 * Bulk check which predictions are unlocked for a user
 */
function getUnlockedPredictionIds(userId, predictionIds) {
    return __awaiter(this, void 0, void 0, function () {
        var isVip, unlocks;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (predictionIds.length === 0)
                        return [2 /*return*/, new Set()];
                    return [4 /*yield*/, isUserVip(userId)];
                case 1:
                    isVip = _a.sent();
                    if (isVip) {
                        // VIP has access to all
                        return [2 /*return*/, new Set(predictionIds)];
                    }
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('customer_prediction_unlocks')
                            .select('prediction_id')
                            .where('customer_user_id', '=', userId)
                            .where('prediction_id', 'in', predictionIds)
                            .execute()];
                case 2:
                    unlocks = _a.sent();
                    return [2 /*return*/, new Set(unlocks.map(function (u) { return u.prediction_id; }))];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3;

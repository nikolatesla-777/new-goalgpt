"use strict";
/**
 * Partners Service - Partner/Bayi Program Management
 *
 * Partner program for business affiliates:
 * - 20% commission on subscriptions from their referral code
 * - Dedicated partner dashboard
 * - Monthly payouts
 * - Analytics tracking
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
exports.applyForPartnership = applyForPartnership;
exports.approvePartner = approvePartner;
exports.rejectPartner = rejectPartner;
exports.suspendPartner = suspendPartner;
exports.reactivatePartner = reactivatePartner;
exports.getPartnerByUserId = getPartnerByUserId;
exports.getPartnerById = getPartnerById;
exports.getPartnerByReferralCode = getPartnerByReferralCode;
exports.getAllPartners = getAllPartners;
exports.getPartnerAnalytics = getPartnerAnalytics;
exports.getPartnerStats = getPartnerStats;
exports.trackPartnerSubscription = trackPartnerSubscription;
exports.updateCommissionRate = updateCommissionRate;
exports.getPendingApplications = getPendingApplications;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var referrals_service_1 = require("./referrals.service");
/**
 * Apply for partnership program
 */
function applyForPartnership(data) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var existingPartner, partnerCode, isUnique, attempts, existing, partner;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('partners')
                                    .select('id')
                                    .where('customer_user_id', '=', data.userId)
                                    .executeTakeFirst()];
                            case 1:
                                existingPartner = _a.sent();
                                if (existingPartner) {
                                    throw new Error('User already has a partner account');
                                }
                                isUnique = false;
                                attempts = 0;
                                _a.label = 2;
                            case 2:
                                if (!(!isUnique && attempts < 10)) return [3 /*break*/, 4];
                                partnerCode = "PARTNER-".concat((0, referrals_service_1.generateReferralCode)().split('-')[1]); // e.g., PARTNER-A3B7K
                                return [4 /*yield*/, trx
                                        .selectFrom('partners')
                                        .select('id')
                                        .where('referral_code', '=', partnerCode)
                                        .executeTakeFirst()];
                            case 3:
                                existing = _a.sent();
                                if (!existing) {
                                    isUnique = true;
                                    return [3 /*break*/, 4];
                                }
                                attempts++;
                                return [3 /*break*/, 2];
                            case 4:
                                if (!isUnique) {
                                    throw new Error('Failed to generate unique partner code');
                                }
                                return [4 /*yield*/, trx
                                        .insertInto('partners')
                                        .values({
                                        customer_user_id: data.userId,
                                        business_name: data.businessName,
                                        tax_id: data.taxId || null,
                                        phone: data.phone,
                                        email: data.email,
                                        address: data.address || null,
                                        status: 'pending',
                                        commission_rate: 20.0, // Default 20%
                                        referral_code: partnerCode,
                                        total_referrals: 0,
                                        total_subscriptions: 0,
                                        total_revenue: 0.0,
                                        total_commission: 0.0,
                                        last_payout_at: null,
                                        approved_at: null,
                                        approved_by: null,
                                        rejection_reason: null,
                                        notes: data.notes || null,
                                        created_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        updated_at: (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .returning([
                                        'id',
                                        'customer_user_id',
                                        'business_name',
                                        'phone',
                                        'email',
                                        'status',
                                        'referral_code',
                                        'created_at',
                                    ])
                                        .executeTakeFirstOrThrow()];
                            case 5:
                                partner = _a.sent();
                                return [2 /*return*/, partner];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Approve partner application
 */
function approvePartner(partnerId, approvedBy, notes) {
    return __awaiter(this, void 0, void 0, function () {
        var partner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('partners')
                        .set({
                        status: 'approved',
                        approved_at: (0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        approved_by: approvedBy,
                        notes: notes || (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["notes"], ["notes"]))),
                        updated_at: (0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', partnerId)
                        .where('status', '=', 'pending')
                        .returning(['id', 'customer_user_id', 'business_name', 'status', 'referral_code'])
                        .executeTakeFirst()];
                case 1:
                    partner = _a.sent();
                    if (!partner) {
                        throw new Error('Partner not found or already processed');
                    }
                    // TODO: Send approval email/notification
                    return [2 /*return*/, partner];
            }
        });
    });
}
/**
 * Reject partner application
 */
function rejectPartner(partnerId, rejectedBy, reason) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('partners')
                        .set({
                        status: 'rejected',
                        rejection_reason: reason,
                        notes: (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["CONCAT(COALESCE(notes, ''), '\nRejected by: ', ", ", ' - ', ", ")"], ["CONCAT(COALESCE(notes, ''), '\\nRejected by: ', ", ", ' - ', ", ")"])), rejectedBy, reason),
                        updated_at: (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', partnerId)
                        .where('status', '=', 'pending')
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Partner not found or already processed');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Suspend partner account
 */
function suspendPartner(partnerId, reason) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('partners')
                        .set({
                        status: 'suspended',
                        notes: (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["CONCAT(COALESCE(notes, ''), '\nSuspended: ', ", ")"], ["CONCAT(COALESCE(notes, ''), '\\nSuspended: ', ", ")"])), reason),
                        updated_at: (0, kysely_2.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', partnerId)
                        .where('status', '=', 'approved')
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Partner not found or not approved');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Reactivate suspended partner
 */
function reactivatePartner(partnerId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('partners')
                        .set({
                        status: 'approved',
                        notes: (0, kysely_2.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["CONCAT(COALESCE(notes, ''), '\nReactivated at: ', NOW())"], ["CONCAT(COALESCE(notes, ''), '\\nReactivated at: ', NOW())"]))),
                        updated_at: (0, kysely_2.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', partnerId)
                        .where('status', '=', 'suspended')
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Partner not found or not suspended');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Get partner profile by user ID
 */
function getPartnerByUserId(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var partner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('partners')
                        .selectAll()
                        .where('customer_user_id', '=', userId)
                        .executeTakeFirst()];
                case 1:
                    partner = _a.sent();
                    return [2 /*return*/, partner];
            }
        });
    });
}
/**
 * Get partner profile by ID
 */
function getPartnerById(partnerId) {
    return __awaiter(this, void 0, void 0, function () {
        var partner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('partners')
                        .selectAll()
                        .where('id', '=', partnerId)
                        .executeTakeFirst()];
                case 1:
                    partner = _a.sent();
                    return [2 /*return*/, partner];
            }
        });
    });
}
/**
 * Get partner profile by referral code
 */
function getPartnerByReferralCode(code) {
    return __awaiter(this, void 0, void 0, function () {
        var partner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('partners')
                        .selectAll()
                        .where('referral_code', '=', code)
                        .executeTakeFirst()];
                case 1:
                    partner = _a.sent();
                    return [2 /*return*/, partner];
            }
        });
    });
}
/**
 * Get all partners (admin)
 */
function getAllPartners(status_1) {
    return __awaiter(this, arguments, void 0, function (status, limit, offset) {
        var query;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = kysely_1.db
                        .selectFrom('partners as p')
                        .innerJoin('customer_users as cu', 'cu.id', 'p.customer_user_id')
                        .select([
                        'p.id',
                        'p.business_name',
                        'p.phone',
                        'p.email',
                        'p.status',
                        'p.commission_rate',
                        'p.referral_code',
                        'p.total_referrals',
                        'p.total_subscriptions',
                        'p.total_revenue',
                        'p.total_commission',
                        'p.created_at',
                        'p.approved_at',
                        'cu.full_name as owner_name',
                    ])
                        .orderBy('p.created_at', 'desc')
                        .limit(limit)
                        .offset(offset);
                    if (status) {
                        query = query.where('p.status', '=', status);
                    }
                    return [4 /*yield*/, query.execute()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get partner analytics (daily breakdown)
 */
function getPartnerAnalytics(partnerId, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var analytics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('partner_analytics')
                        .selectAll()
                        .where('partner_id', '=', partnerId)
                        .where('date', '>=', startDate)
                        .where('date', '<=', endDate)
                        .orderBy('date', 'desc')
                        .execute()];
                case 1:
                    analytics = _a.sent();
                    return [2 /*return*/, analytics.map(function (a) { return ({
                            date: a.date,
                            newSignups: a.new_signups,
                            newSubscriptions: a.new_subscriptions,
                            revenue: Number(a.revenue),
                            commission: Number(a.commission),
                            activeSubscribers: a.active_subscribers,
                            churnCount: a.churn_count,
                        }); })];
            }
        });
    });
}
/**
 * Get partner summary statistics
 */
function getPartnerStats(partnerId) {
    return __awaiter(this, void 0, void 0, function () {
        var partner, thisMonth, lastMonth;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPartnerById(partnerId)];
                case 1:
                    partner = _a.sent();
                    if (!partner) {
                        throw new Error('Partner not found');
                    }
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('partner_analytics')
                            .select([
                            (0, kysely_2.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["SUM(new_signups)"], ["SUM(new_signups)"]))).as('signups'),
                            (0, kysely_2.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["SUM(new_subscriptions)"], ["SUM(new_subscriptions)"]))).as('subscriptions'),
                            (0, kysely_2.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["SUM(revenue)"], ["SUM(revenue)"]))).as('revenue'),
                            (0, kysely_2.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["SUM(commission)"], ["SUM(commission)"]))).as('commission'),
                        ])
                            .where('partner_id', '=', partnerId)
                            .where('date', '>=', new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                            .executeTakeFirst()];
                case 2:
                    thisMonth = _a.sent();
                    return [4 /*yield*/, kysely_1.db
                            .selectFrom('partner_analytics')
                            .select([
                            (0, kysely_2.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["SUM(new_signups)"], ["SUM(new_signups)"]))).as('signups'),
                            (0, kysely_2.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["SUM(new_subscriptions)"], ["SUM(new_subscriptions)"]))).as('subscriptions'),
                            (0, kysely_2.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["SUM(revenue)"], ["SUM(revenue)"]))).as('revenue'),
                            (0, kysely_2.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["SUM(commission)"], ["SUM(commission)"]))).as('commission'),
                        ])
                            .where('partner_id', '=', partnerId)
                            .where('date', '>=', new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))
                            .where('date', '<', new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                            .executeTakeFirst()];
                case 3:
                    lastMonth = _a.sent();
                    return [2 /*return*/, {
                            lifetime: {
                                totalReferrals: partner.total_referrals,
                                totalSubscriptions: partner.total_subscriptions,
                                totalRevenue: Number(partner.total_revenue),
                                totalCommission: Number(partner.total_commission),
                            },
                            thisMonth: {
                                signups: Number((thisMonth === null || thisMonth === void 0 ? void 0 : thisMonth.signups) || 0),
                                subscriptions: Number((thisMonth === null || thisMonth === void 0 ? void 0 : thisMonth.subscriptions) || 0),
                                revenue: Number((thisMonth === null || thisMonth === void 0 ? void 0 : thisMonth.revenue) || 0),
                                commission: Number((thisMonth === null || thisMonth === void 0 ? void 0 : thisMonth.commission) || 0),
                            },
                            lastMonth: {
                                signups: Number((lastMonth === null || lastMonth === void 0 ? void 0 : lastMonth.signups) || 0),
                                subscriptions: Number((lastMonth === null || lastMonth === void 0 ? void 0 : lastMonth.subscriptions) || 0),
                                revenue: Number((lastMonth === null || lastMonth === void 0 ? void 0 : lastMonth.revenue) || 0),
                                commission: Number((lastMonth === null || lastMonth === void 0 ? void 0 : lastMonth.commission) || 0),
                            },
                            commissionRate: Number(partner.commission_rate),
                            lastPayoutAt: partner.last_payout_at,
                        }];
            }
        });
    });
}
/**
 * Track partner subscription (called when subscription created with partner code)
 */
function trackPartnerSubscription(partnerCode, subscriptionRevenue) {
    return __awaiter(this, void 0, void 0, function () {
        var partner, commission, today;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPartnerByReferralCode(partnerCode)];
                case 1:
                    partner = _a.sent();
                    if (!partner) {
                        throw new Error('Partner not found');
                    }
                    commission = (subscriptionRevenue * partner.commission_rate) / 100;
                    // Update partner totals
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('partners')
                            .set({
                            total_subscriptions: (0, kysely_2.sql)(templateObject_20 || (templateObject_20 = __makeTemplateObject(["total_subscriptions + 1"], ["total_subscriptions + 1"]))),
                            total_revenue: (0, kysely_2.sql)(templateObject_21 || (templateObject_21 = __makeTemplateObject(["total_revenue + ", ""], ["total_revenue + ", ""])), subscriptionRevenue),
                            total_commission: (0, kysely_2.sql)(templateObject_22 || (templateObject_22 = __makeTemplateObject(["total_commission + ", ""], ["total_commission + ", ""])), commission),
                            updated_at: (0, kysely_2.sql)(templateObject_23 || (templateObject_23 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .where('id', '=', partner.id)
                            .execute()];
                case 2:
                    // Update partner totals
                    _a.sent();
                    today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return [4 /*yield*/, kysely_1.db
                            .insertInto('partner_analytics')
                            .values({
                            partner_id: partner.id,
                            date: today,
                            new_signups: 0,
                            new_subscriptions: 1,
                            revenue: subscriptionRevenue,
                            commission: commission,
                            active_subscribers: 0,
                            churn_count: 0,
                            created_at: (0, kysely_2.sql)(templateObject_24 || (templateObject_24 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .onConflict(function (oc) {
                            return oc.columns(['partner_id', 'date']).doUpdateSet({
                                new_subscriptions: (0, kysely_2.sql)(templateObject_25 || (templateObject_25 = __makeTemplateObject(["partner_analytics.new_subscriptions + 1"], ["partner_analytics.new_subscriptions + 1"]))),
                                revenue: (0, kysely_2.sql)(templateObject_26 || (templateObject_26 = __makeTemplateObject(["partner_analytics.revenue + ", ""], ["partner_analytics.revenue + ", ""])), subscriptionRevenue),
                                commission: (0, kysely_2.sql)(templateObject_27 || (templateObject_27 = __makeTemplateObject(["partner_analytics.commission + ", ""], ["partner_analytics.commission + ", ""])), commission),
                            });
                        })
                            .execute()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Update partner commission rate (admin)
 */
function updateCommissionRate(partnerId, newRate) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (newRate < 0 || newRate > 100) {
                        throw new Error('Commission rate must be between 0 and 100');
                    }
                    return [4 /*yield*/, kysely_1.db
                            .updateTable('partners')
                            .set({
                            commission_rate: newRate,
                            updated_at: (0, kysely_2.sql)(templateObject_28 || (templateObject_28 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        })
                            .where('id', '=', partnerId)
                            .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Partner not found');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Get pending partner applications (admin)
 */
function getPendingApplications() {
    return __awaiter(this, arguments, void 0, function (limit) {
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('partners as p')
                        .innerJoin('customer_users as cu', 'cu.id', 'p.customer_user_id')
                        .select([
                        'p.id',
                        'p.business_name',
                        'p.tax_id',
                        'p.phone',
                        'p.email',
                        'p.address',
                        'p.notes',
                        'p.created_at',
                        'cu.full_name as owner_name',
                        'cu.username',
                    ])
                        .where('p.status', '=', 'pending')
                        .orderBy('p.created_at', 'asc')
                        .limit(limit)
                        .execute()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28;

"use strict";
/**
 * Dashboard Service
 * Business logic for calculating dashboard metrics
 */
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
exports.getDashboardStats = getDashboardStats;
exports.getRevenueChart = getRevenueChart;
exports.getRevenueTrend = getRevenueTrend;
exports.getSubscribersTrend = getSubscribersTrend;
exports.getSalesTrend = getSalesTrend;
exports.getBillingErrorsTrend = getBillingErrorsTrend;
exports.getSignupsTrend = getSignupsTrend;
exports.getTrialsTrend = getTrialsTrend;
exports.getCancellationsTrend = getCancellationsTrend;
exports.getChurnTrend = getChurnTrend;
exports.getRevenueDetails = getRevenueDetails;
exports.getActiveSubscribersDetails = getActiveSubscribersDetails;
exports.getSignupsDetails = getSignupsDetails;
exports.getTrialsDetails = getTrialsDetails;
exports.getCancellationsDetails = getCancellationsDetails;
exports.getChurnDetails = getChurnDetails;
exports.getBillingErrorsDetails = getBillingErrorsDetails;
exports.getFirstPurchaseTrend = getFirstPurchaseTrend;
exports.getFirstPurchaseDetails = getFirstPurchaseDetails;
exports.getConversionTrend = getConversionTrend;
exports.getConversionDetails = getConversionDetails;
exports.getTotalMembersTrend = getTotalMembersTrend;
exports.getTotalMembersDetails = getTotalMembersDetails;
var connection_1 = require("../database/connection");
var logger_1 = require("../utils/logger");
function getPeriodDates(period) {
    var now = new Date();
    var periodStart;
    var previousStart;
    switch (period) {
        case 'today':
            periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            previousStart = new Date(periodStart);
            previousStart.setDate(previousStart.getDate() - 1);
            break;
        case 'week':
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - 7);
            previousStart = new Date(periodStart);
            previousStart.setDate(previousStart.getDate() - 7);
            break;
        case 'month':
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            previousStart = new Date(periodStart);
            previousStart.setMonth(previousStart.getMonth() - 1);
            break;
        case 'year':
            periodStart = new Date(now.getFullYear(), 0, 1);
            previousStart = new Date(periodStart);
            previousStart.setFullYear(previousStart.getFullYear() - 1);
            break;
    }
    return { current: now, previous: previousStart, periodStart: periodStart };
}
function calculateChange(current, previous) {
    if (previous === 0)
        return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}
function getDashboardStats() {
    return __awaiter(this, arguments, void 0, function (period) {
        var _a, periodStart, previous, revenueQuery, revenueResult, currentRevenue, previousRevenue, revenueIos, revenueAndroid, subscribersQuery, subscribersResult, activeSubscribers, subscribersIos, subscribersAndroid, salesQuery, salesResult, currentSales, previousSales, salesIos, salesAndroid, errorsQuery, errorsResult, billingErrors, errorsIos, errorsAndroid, signupsQuery, signupsResult, currentSignups, previousSignups, signupsIos, signupsAndroid, trialsQuery, trialsResult, trials, trialsIos, trialsAndroid, firstPurchaseQuery, firstPurchaseResult, firstPurchase, firstPurchaseIos, firstPurchaseAndroid, conversionRate, conversionIos, conversionAndroid, cancellationsQuery, cancellationsResult, currentCancellations, previousCancellations, cancellationsIos, cancellationsAndroid, churnRate, totalMembersQuery, totalMembersResult, totalMembers, membersIos, membersAndroid, error_1;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
        if (period === void 0) { period = 'month'; }
        return __generator(this, function (_8) {
            switch (_8.label) {
                case 0:
                    _a = getPeriodDates(period), periodStart = _a.periodStart, previous = _a.previous;
                    _8.label = 1;
                case 1:
                    _8.trys.push([1, 11, , 12]);
                    revenueQuery = "\n      SELECT \n        COALESCE(SUM(CASE WHEN created_at >= $1 THEN amount ELSE 0 END), 0) as current_revenue,\n        COALESCE(SUM(CASE WHEN created_at >= $2 AND created_at < $1 THEN amount ELSE 0 END), 0) as previous_revenue,\n        COALESCE(SUM(CASE WHEN created_at >= $1 AND platform = 'ios' THEN amount ELSE 0 END), 0) as revenue_ios,\n        COALESCE(SUM(CASE WHEN created_at >= $1 AND platform = 'android' THEN amount ELSE 0 END), 0) as revenue_android\n      FROM customer_subscriptions\n      WHERE status NOT IN ('canceled', 'expired')\n    ";
                    return [4 /*yield*/, connection_1.pool.query(revenueQuery, [periodStart, previous])];
                case 2:
                    revenueResult = _8.sent();
                    currentRevenue = parseFloat(((_b = revenueResult.rows[0]) === null || _b === void 0 ? void 0 : _b.current_revenue) || 0);
                    previousRevenue = parseFloat(((_c = revenueResult.rows[0]) === null || _c === void 0 ? void 0 : _c.previous_revenue) || 0);
                    revenueIos = parseFloat(((_d = revenueResult.rows[0]) === null || _d === void 0 ? void 0 : _d.revenue_ios) || 0);
                    revenueAndroid = parseFloat(((_e = revenueResult.rows[0]) === null || _e === void 0 ? void 0 : _e.revenue_android) || 0);
                    subscribersQuery = "\n      SELECT \n        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,\n        COUNT(CASE WHEN status = 'active' AND platform = 'ios' THEN 1 END) as active_ios,\n        COUNT(CASE WHEN status = 'active' AND platform = 'android' THEN 1 END) as active_android,\n        COUNT(CASE WHEN status = 'active' AND created_at >= $1 THEN 1 END) as new_active\n      FROM customer_subscriptions\n    ";
                    return [4 /*yield*/, connection_1.pool.query(subscribersQuery, [periodStart])];
                case 3:
                    subscribersResult = _8.sent();
                    activeSubscribers = parseInt(((_f = subscribersResult.rows[0]) === null || _f === void 0 ? void 0 : _f.active_count) || 0);
                    subscribersIos = parseInt(((_g = subscribersResult.rows[0]) === null || _g === void 0 ? void 0 : _g.active_ios) || 0);
                    subscribersAndroid = parseInt(((_h = subscribersResult.rows[0]) === null || _h === void 0 ? void 0 : _h.active_android) || 0);
                    salesQuery = "\n      SELECT \n        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as current_sales,\n        COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as previous_sales,\n        COUNT(CASE WHEN created_at >= $1 AND platform = 'ios' THEN 1 END) as sales_ios,\n        COUNT(CASE WHEN created_at >= $1 AND platform = 'android' THEN 1 END) as sales_android\n      FROM customer_subscriptions\n    ";
                    return [4 /*yield*/, connection_1.pool.query(salesQuery, [periodStart, previous])];
                case 4:
                    salesResult = _8.sent();
                    currentSales = parseInt(((_j = salesResult.rows[0]) === null || _j === void 0 ? void 0 : _j.current_sales) || 0);
                    previousSales = parseInt(((_k = salesResult.rows[0]) === null || _k === void 0 ? void 0 : _k.previous_sales) || 0);
                    salesIos = parseInt(((_l = salesResult.rows[0]) === null || _l === void 0 ? void 0 : _l.sales_ios) || 0);
                    salesAndroid = parseInt(((_m = salesResult.rows[0]) === null || _m === void 0 ? void 0 : _m.sales_android) || 0);
                    errorsQuery = "\n      SELECT \n        COUNT(*) as error_count,\n        COUNT(CASE WHEN platform = 'ios' THEN 1 END) as errors_ios,\n        COUNT(CASE WHEN platform = 'android' THEN 1 END) as errors_android\n      FROM customer_subscriptions\n      WHERE status = 'billing_error' OR status = 'past_due'\n    ";
                    return [4 /*yield*/, connection_1.pool.query(errorsQuery)];
                case 5:
                    errorsResult = _8.sent();
                    billingErrors = parseInt(((_o = errorsResult.rows[0]) === null || _o === void 0 ? void 0 : _o.error_count) || 0);
                    errorsIos = parseInt(((_p = errorsResult.rows[0]) === null || _p === void 0 ? void 0 : _p.errors_ios) || 0);
                    errorsAndroid = parseInt(((_q = errorsResult.rows[0]) === null || _q === void 0 ? void 0 : _q.errors_android) || 0);
                    signupsQuery = "\n      SELECT \n        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as current_signups,\n        COUNT(CASE WHEN created_at >= $2 AND created_at < $1 THEN 1 END) as previous_signups,\n        COUNT(CASE WHEN created_at >= $1 AND registration_platform = 'ios' THEN 1 END) as signups_ios,\n        COUNT(CASE WHEN created_at >= $1 AND registration_platform = 'android' THEN 1 END) as signups_android\n      FROM customer_users\n      WHERE deleted_at IS NULL\n    ";
                    return [4 /*yield*/, connection_1.pool.query(signupsQuery, [periodStart, previous])];
                case 6:
                    signupsResult = _8.sent();
                    currentSignups = parseInt(((_r = signupsResult.rows[0]) === null || _r === void 0 ? void 0 : _r.current_signups) || 0);
                    previousSignups = parseInt(((_s = signupsResult.rows[0]) === null || _s === void 0 ? void 0 : _s.previous_signups) || 0);
                    signupsIos = parseInt(((_t = signupsResult.rows[0]) === null || _t === void 0 ? void 0 : _t.signups_ios) || 0);
                    signupsAndroid = parseInt(((_u = signupsResult.rows[0]) === null || _u === void 0 ? void 0 : _u.signups_android) || 0);
                    trialsQuery = "\n      SELECT \n        COUNT(*) as trial_count,\n        COUNT(CASE WHEN platform = 'ios' THEN 1 END) as trials_ios,\n        COUNT(CASE WHEN platform = 'android' THEN 1 END) as trials_android\n      FROM customer_subscriptions\n      WHERE status = 'trialing' OR status = 'trial'\n    ";
                    return [4 /*yield*/, connection_1.pool.query(trialsQuery)];
                case 7:
                    trialsResult = _8.sent();
                    trials = parseInt(((_v = trialsResult.rows[0]) === null || _v === void 0 ? void 0 : _v.trial_count) || 0);
                    trialsIos = parseInt(((_w = trialsResult.rows[0]) === null || _w === void 0 ? void 0 : _w.trials_ios) || 0);
                    trialsAndroid = parseInt(((_x = trialsResult.rows[0]) === null || _x === void 0 ? void 0 : _x.trials_android) || 0);
                    firstPurchaseQuery = "\n      SELECT \n        COUNT(DISTINCT customer_user_id) as first_purchase_count,\n        COUNT(DISTINCT CASE WHEN platform = 'ios' THEN customer_user_id END) as first_purchase_ios,\n        COUNT(DISTINCT CASE WHEN platform = 'android' THEN customer_user_id END) as first_purchase_android\n      FROM customer_subscriptions\n      WHERE created_at >= $1\n      AND customer_user_id NOT IN (\n        SELECT DISTINCT customer_user_id \n        FROM customer_subscriptions \n        WHERE created_at < $1\n      )\n    ";
                    return [4 /*yield*/, connection_1.pool.query(firstPurchaseQuery, [periodStart])];
                case 8:
                    firstPurchaseResult = _8.sent();
                    firstPurchase = parseInt(((_y = firstPurchaseResult.rows[0]) === null || _y === void 0 ? void 0 : _y.first_purchase_count) || 0);
                    firstPurchaseIos = parseInt(((_z = firstPurchaseResult.rows[0]) === null || _z === void 0 ? void 0 : _z.first_purchase_ios) || 0);
                    firstPurchaseAndroid = parseInt(((_0 = firstPurchaseResult.rows[0]) === null || _0 === void 0 ? void 0 : _0.first_purchase_android) || 0);
                    conversionRate = currentSignups > 0 ? Math.round((firstPurchase / currentSignups) * 100) : 0;
                    conversionIos = signupsIos > 0 ? Math.round((firstPurchaseIos / signupsIos) * 100) : 0;
                    conversionAndroid = signupsAndroid > 0 ? Math.round((firstPurchaseAndroid / signupsAndroid) * 100) : 0;
                    cancellationsQuery = "\n      SELECT \n        COUNT(CASE WHEN canceled_at >= $1 THEN 1 END) as current_cancellations,\n        COUNT(CASE WHEN canceled_at >= $2 AND canceled_at < $1 THEN 1 END) as previous_cancellations,\n        COUNT(CASE WHEN canceled_at >= $1 AND platform = 'ios' THEN 1 END) as cancellations_ios,\n        COUNT(CASE WHEN canceled_at >= $1 AND platform = 'android' THEN 1 END) as cancellations_android\n      FROM customer_subscriptions\n      WHERE canceled_at IS NOT NULL\n    ";
                    return [4 /*yield*/, connection_1.pool.query(cancellationsQuery, [periodStart, previous])];
                case 9:
                    cancellationsResult = _8.sent();
                    currentCancellations = parseInt(((_1 = cancellationsResult.rows[0]) === null || _1 === void 0 ? void 0 : _1.current_cancellations) || 0);
                    previousCancellations = parseInt(((_2 = cancellationsResult.rows[0]) === null || _2 === void 0 ? void 0 : _2.previous_cancellations) || 0);
                    cancellationsIos = parseInt(((_3 = cancellationsResult.rows[0]) === null || _3 === void 0 ? void 0 : _3.cancellations_ios) || 0);
                    cancellationsAndroid = parseInt(((_4 = cancellationsResult.rows[0]) === null || _4 === void 0 ? void 0 : _4.cancellations_android) || 0);
                    churnRate = activeSubscribers > 0 ? Math.round((currentCancellations / activeSubscribers) * 100) : 0;
                    totalMembersQuery = "\n      SELECT \n        COUNT(*) as total_members,\n        COUNT(CASE WHEN registration_platform = 'ios' THEN 1 END) as members_ios,\n        COUNT(CASE WHEN registration_platform = 'android' THEN 1 END) as members_android\n      FROM customer_users\n      WHERE deleted_at IS NULL\n    ";
                    return [4 /*yield*/, connection_1.pool.query(totalMembersQuery)];
                case 10:
                    totalMembersResult = _8.sent();
                    totalMembers = parseInt(((_5 = totalMembersResult.rows[0]) === null || _5 === void 0 ? void 0 : _5.total_members) || 0);
                    membersIos = parseInt(((_6 = totalMembersResult.rows[0]) === null || _6 === void 0 ? void 0 : _6.members_ios) || 0);
                    membersAndroid = parseInt(((_7 = totalMembersResult.rows[0]) === null || _7 === void 0 ? void 0 : _7.members_android) || 0);
                    return [2 /*return*/, {
                            financial: {
                                totalRevenue: currentRevenue,
                                revenueChange: calculateChange(currentRevenue, previousRevenue),
                                revenueIos: revenueIos,
                                revenueAndroid: revenueAndroid,
                                activeSubscribers: activeSubscribers,
                                subscribersChange: 0,
                                subscribersIos: subscribersIos,
                                subscribersAndroid: subscribersAndroid,
                                salesCount: currentSales,
                                salesChange: calculateChange(currentSales, previousSales),
                                salesIos: salesIos,
                                salesAndroid: salesAndroid,
                                billingErrors: billingErrors,
                                errorsChange: 0,
                                errorsIos: errorsIos,
                                errorsAndroid: errorsAndroid,
                            },
                            acquisition: {
                                newSignups: currentSignups,
                                signupsChange: calculateChange(currentSignups, previousSignups),
                                signupsIos: signupsIos,
                                signupsAndroid: signupsAndroid,
                                trials: trials,
                                trialsChange: 0,
                                trialsIos: trialsIos,
                                trialsAndroid: trialsAndroid,
                                firstPurchase: firstPurchase,
                                firstPurchaseChange: 0,
                                firstPurchaseIos: firstPurchaseIos,
                                firstPurchaseAndroid: firstPurchaseAndroid,
                                conversionRate: conversionRate,
                                conversionChange: 0,
                                conversionIos: conversionIos,
                                conversionAndroid: conversionAndroid,
                            },
                            retention: {
                                cancellations: currentCancellations,
                                cancellationsChange: calculateChange(currentCancellations, previousCancellations),
                                cancellationsIos: cancellationsIos,
                                cancellationsAndroid: cancellationsAndroid,
                                churnRate: churnRate,
                                churnChange: 0,
                                totalMembers: totalMembers,
                                membersChange: 0,
                                membersIos: membersIos,
                                membersAndroid: membersAndroid,
                            },
                        }];
                case 11:
                    error_1 = _8.sent();
                    logger_1.logger.error('Error fetching dashboard stats:', error_1);
                    throw error_1;
                case 12: return [2 /*return*/];
            }
        });
    });
}
function getRevenueChart() {
    return __awaiter(this, arguments, void 0, function (period) {
        var interval, limit, query, result, error_2;
        if (period === void 0) { period = 'month'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    interval = void 0;
                    limit = void 0;
                    switch (period) {
                        case 'today':
                            interval = 'hour';
                            limit = 24;
                            break;
                        case 'week':
                            interval = 'day';
                            limit = 7;
                            break;
                        case 'month':
                            interval = 'day';
                            limit = 30;
                            break;
                        case 'year':
                            interval = 'month';
                            limit = 12;
                            break;
                    }
                    query = "\n      SELECT \n        DATE_TRUNC($1, created_at) as date,\n        COALESCE(SUM(amount), 0) as revenue\n      FROM customer_subscriptions\n      WHERE created_at >= NOW() - INTERVAL '".concat(limit, " ").concat(interval, "s'\n      GROUP BY DATE_TRUNC($1, created_at)\n      ORDER BY date ASC\n    ");
                    return [4 /*yield*/, connection_1.pool.query(query, [interval])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) { return ({
                            date: row.date.toISOString(),
                            revenue: parseFloat(row.revenue),
                        }); })];
                case 2:
                    error_2 = _a.sent();
                    logger_1.logger.error('Error fetching revenue chart:', error_2);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getTrendData(tableName_1, valueColumn_1, dateColumn_1, period_1) {
    return __awaiter(this, arguments, void 0, function (tableName, valueColumn, dateColumn, period, whereClause) {
        var periodStart, query, result, error_3;
        if (whereClause === void 0) { whereClause = ''; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n            SELECT \n                DATE_TRUNC('day', ".concat(dateColumn, ") as date,\n                COALESCE(").concat(valueColumn === 'COUNT' ? 'COUNT(*)' : "SUM(".concat(valueColumn, ")"), ", 0) as total,\n                COALESCE(").concat(valueColumn === 'COUNT' ? "COUNT(CASE WHEN LOWER(platform) = 'ios' THEN 1 END)" : "SUM(CASE WHEN LOWER(platform) = 'ios' THEN ".concat(valueColumn, " ELSE 0 END)"), ", 0) as ios,\n                COALESCE(").concat(valueColumn === 'COUNT' ? "COUNT(CASE WHEN LOWER(platform) IN ('android', 'google') THEN 1 END)" : "SUM(CASE WHEN LOWER(platform) IN ('android', 'google') THEN ".concat(valueColumn, " ELSE 0 END)"), ", 0) as android\n            FROM ").concat(tableName, "\n            WHERE ").concat(dateColumn, " >= $1\n            ").concat(whereClause, "\n            GROUP BY DATE_TRUNC('day', ").concat(dateColumn, ")\n            ORDER BY date ASC\n        ");
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) { return ({
                            date: row.date.toISOString().split('T')[0],
                            total: parseFloat(row.total) || 0,
                            ios: parseFloat(row.ios) || 0,
                            android: parseFloat(row.android) || 0,
                        }); })];
                case 3:
                    error_3 = _a.sent();
                    logger_1.logger.error("Error fetching trend data for ".concat(tableName, ":"), error_3);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getRevenueTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'amount', 'created_at', period)];
        });
    });
}
function getSubscribersTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'COUNT', 'created_at', period, "AND status = 'active'")];
        });
    });
}
function getSalesTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'COUNT', 'created_at', period)];
        });
    });
}
function getBillingErrorsTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'COUNT', 'updated_at', period, "AND status IN ('billing_error', 'past_due')")];
        });
    });
}
function getSignupsTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        var periodStart, query, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n            SELECT \n                DATE_TRUNC('day', created_at) as date,\n                COUNT(*) as total,\n                COUNT(CASE WHEN LOWER(registration_platform) = 'ios' THEN 1 END) as ios,\n                COUNT(CASE WHEN LOWER(registration_platform) IN ('android', 'google') THEN 1 END) as android\n            FROM customer_users\n            WHERE created_at >= $1 AND deleted_at IS NULL\n            GROUP BY DATE_TRUNC('day', created_at)\n            ORDER BY date ASC\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) { return ({
                            date: row.date.toISOString().split('T')[0],
                            total: parseInt(row.total) || 0,
                            ios: parseInt(row.ios) || 0,
                            android: parseInt(row.android) || 0,
                        }); })];
                case 3:
                    error_4 = _a.sent();
                    logger_1.logger.error('Error fetching signups trend:', error_4);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getTrialsTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'COUNT', 'started_at', period, "AND status IN ('trialing', 'trial')")];
        });
    });
}
function getCancellationsTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'COUNT', 'canceled_at', period, 'AND canceled_at IS NOT NULL')];
        });
    });
}
function getChurnTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getTrendData('customer_subscriptions', 'COUNT', 'expired_at', period, "AND status = 'expired'")];
        });
    });
}
function getRevenueDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var periodStart, query, result, error_5;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n            SELECT \n                cs.id,\n                cu.id as user_id,\n                cu.email,\n                cu.full_name,\n                cu.phone,\n                cs.platform,\n                sp.name as plan_name,\n                cs.amount,\n                cs.status,\n                cs.started_at,\n                cs.expired_at,\n                cs.canceled_at,\n                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining,\n                (SELECT COALESCE(SUM(amount), 0) FROM customer_subscriptions WHERE customer_user_id = cu.id) as total_spent,\n                (SELECT COUNT(*) FROM customer_subscriptions WHERE customer_user_id = cu.id) as transaction_count\n            FROM customer_subscriptions cs\n            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id\n            WHERE cs.created_at >= $1\n            ORDER BY cs.created_at DESC\n            LIMIT $2\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart, limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b, _c;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: row.plan_name || 'Unknown',
                                amount: parseFloat(row.amount) || 0,
                                status: row.status || 'unknown',
                                started_at: ((_a = row.started_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                expired_at: ((_b = row.expired_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                                canceled_at: ((_c = row.canceled_at) === null || _c === void 0 ? void 0 : _c.toISOString()) || '',
                                days_remaining: parseInt(row.days_remaining) || 0,
                                total_spent: parseFloat(row.total_spent) || 0,
                                transaction_count: parseInt(row.transaction_count) || 0,
                            });
                        })];
                case 3:
                    error_5 = _a.sent();
                    logger_1.logger.error('Error fetching revenue details:', error_5);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getActiveSubscribersDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var query, result, error_6;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    query = "\n            SELECT \n                cs.id,\n                cu.id as user_id,\n                cu.email,\n                cu.full_name,\n                cu.phone,\n                cs.platform,\n                sp.name as plan_name,\n                cs.amount,\n                cs.status,\n                cs.auto_renew_enabled,\n                cs.started_at,\n                cs.expired_at,\n                cs.canceled_at,\n                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining,\n                (SELECT COALESCE(SUM(amount), 0) FROM customer_subscriptions WHERE customer_user_id = cu.id) as total_spent,\n                (SELECT COUNT(*) FROM customer_subscriptions WHERE customer_user_id = cu.id) as transaction_count\n            FROM customer_subscriptions cs\n            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id\n            WHERE cs.status = 'active'\n            ORDER BY cs.started_at DESC\n            LIMIT $1\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b, _c;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: row.plan_name || 'Unknown',
                                amount: parseFloat(row.amount) || 0,
                                status: row.status || 'unknown',
                                auto_renew: row.auto_renew_enabled || false,
                                started_at: ((_a = row.started_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                expired_at: ((_b = row.expired_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                                canceled_at: ((_c = row.canceled_at) === null || _c === void 0 ? void 0 : _c.toISOString()) || '',
                                days_remaining: parseInt(row.days_remaining) || 0,
                                total_spent: parseFloat(row.total_spent) || 0,
                                transaction_count: parseInt(row.transaction_count) || 0,
                            });
                        })];
                case 2:
                    error_6 = _a.sent();
                    logger_1.logger.error('Error fetching active subscribers details:', error_6);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getSignupsDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var periodStart, query, result, error_7;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n            SELECT \n                id,\n                email,\n                full_name,\n                phone,\n                registration_platform as platform,\n                created_at\n            FROM customer_users\n            WHERE created_at >= $1 AND deleted_at IS NULL\n            ORDER BY created_at DESC\n            LIMIT $2\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart, limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a;
                            return ({
                                id: row.id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                created_at: ((_a = row.created_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                            });
                        })];
                case 3:
                    error_7 = _a.sent();
                    logger_1.logger.error('Error fetching signups details:', error_7);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getTrialsDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var query, result, error_8;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    query = "\n            SELECT \n                cs.id,\n                cu.id as user_id,\n                cu.email,\n                cu.full_name,\n                cu.phone,\n                cs.platform,\n                sp.name as plan_name,\n                cs.status,\n                cs.started_at,\n                cs.expired_at,\n                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining\n            FROM customer_subscriptions cs\n            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id\n            WHERE cs.status IN ('trialing', 'trial')\n            ORDER BY cs.started_at DESC\n            LIMIT $1\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: row.plan_name || 'Unknown',
                                amount: 0,
                                status: 'trial',
                                started_at: ((_a = row.started_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                expired_at: ((_b = row.expired_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                                canceled_at: '',
                                days_remaining: parseInt(row.days_remaining) || 0,
                                total_spent: 0,
                                transaction_count: 0,
                            });
                        })];
                case 2:
                    error_8 = _a.sent();
                    logger_1.logger.error('Error fetching trials details:', error_8);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getCancellationsDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var periodStart, query, result, error_9;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n            SELECT \n                cs.id,\n                cu.id as user_id,\n                cu.email,\n                cu.full_name,\n                cu.phone,\n                cs.platform,\n                sp.name as plan_name,\n                cs.status,\n                cs.canceled_at,\n                cs.expired_at,\n                GREATEST(0, EXTRACT(DAY FROM (cs.expired_at - NOW()))) as days_remaining\n            FROM customer_subscriptions cs\n            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n            LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id\n            WHERE cs.canceled_at >= $1 AND cs.canceled_at IS NOT NULL\n            ORDER BY cs.canceled_at DESC\n            LIMIT $2\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart, limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: row.plan_name || 'Unknown',
                                amount: 0,
                                status: row.status || 'canceled',
                                started_at: '',
                                expired_at: ((_a = row.expired_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                canceled_at: ((_b = row.canceled_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                                days_remaining: parseInt(row.days_remaining) || 0,
                                total_spent: 0,
                                transaction_count: 0,
                            });
                        })];
                case 3:
                    error_9 = _a.sent();
                    logger_1.logger.error('Error fetching cancellations details:', error_9);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getChurnDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var periodStart, query, result, error_10;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n            SELECT \n                cs.id,\n                cu.id as user_id,\n                cu.email,\n                cu.full_name,\n                cu.phone,\n                cs.platform,\n                cs.status,\n                cs.expired_at,\n                cu.last_seen_at\n            FROM customer_subscriptions cs\n            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n            WHERE cs.status = 'expired' AND cs.expired_at >= $1\n            ORDER BY cs.expired_at DESC\n            LIMIT $2\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart, limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: '',
                                amount: 0,
                                status: 'churned',
                                started_at: '',
                                expired_at: ((_a = row.expired_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                canceled_at: '',
                                days_remaining: 0,
                                total_spent: 0,
                                transaction_count: 0,
                                last_seen_at: ((_b = row.last_seen_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                            });
                        })];
                case 3:
                    error_10 = _a.sent();
                    logger_1.logger.error('Error fetching churn details:', error_10);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getBillingErrorsDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var query, result, error_11;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    query = "\n            SELECT \n                cs.id,\n                cu.id as user_id,\n                cu.email,\n                cu.full_name,\n                cu.phone,\n                cs.platform,\n                cs.status,\n                cu.last_seen_at\n            FROM customer_subscriptions cs\n            LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n            WHERE cs.status IN ('billing_error', 'past_due')\n            ORDER BY cs.updated_at DESC\n            LIMIT $1\n        ";
                    return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: '',
                                amount: 0,
                                status: 'billing_error',
                                started_at: '',
                                expired_at: '',
                                canceled_at: '',
                                days_remaining: 0,
                                total_spent: 0,
                                transaction_count: 0,
                                last_seen_at: ((_a = row.last_seen_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                            });
                        })];
                case 2:
                    error_11 = _a.sent();
                    logger_1.logger.error('Error fetching billing errors details:', error_11);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ============ FIRST PURCHASE ============
function getFirstPurchaseTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        var periodStart, query, result, error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n      SELECT \n        DATE(cs.created_at) as date,\n        COUNT(*) as total,\n        COUNT(CASE WHEN cs.platform IN ('ios', 'apple') THEN 1 END) as ios,\n        COUNT(CASE WHEN cs.platform IN ('android', 'google') THEN 1 END) as android\n      FROM customer_subscriptions cs\n      LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n      WHERE cs.created_at >= $1\n        AND cs.created_at = (\n          SELECT MIN(cs2.created_at) \n          FROM customer_subscriptions cs2 \n          WHERE cs2.customer_user_id = cs.customer_user_id\n        )\n      GROUP BY DATE(cs.created_at)\n      ORDER BY date ASC\n    ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                date: ((_b = (_a = row.date) === null || _a === void 0 ? void 0 : _a.toISOString()) === null || _b === void 0 ? void 0 : _b.split('T')[0]) || '',
                                total: parseInt(row.total) || 0,
                                ios: parseInt(row.ios) || 0,
                                android: parseInt(row.android) || 0,
                            });
                        })];
                case 3:
                    error_12 = _a.sent();
                    logger_1.logger.error('Error fetching first purchase trend:', error_12);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getFirstPurchaseDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var periodStart, query, result, error_13;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n      SELECT \n        cs.id,\n        cu.id as user_id,\n        cu.email,\n        cu.full_name,\n        cu.phone,\n        cs.platform,\n        sp.plan_name,\n        cs.amount,\n        cs.status,\n        cs.created_at as started_at\n      FROM customer_subscriptions cs\n      LEFT JOIN customer_users cu ON cs.customer_user_id = cu.id\n      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id\n      WHERE cs.created_at >= $1\n        AND cs.created_at = (\n          SELECT MIN(cs2.created_at) \n          FROM customer_subscriptions cs2 \n          WHERE cs2.customer_user_id = cs.customer_user_id\n        )\n      ORDER BY cs.created_at DESC\n      LIMIT $2\n    ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart, limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a;
                            return ({
                                id: row.id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: row.plan_name || 'Unknown',
                                amount: parseFloat(row.amount) || 0,
                                status: row.status || '',
                                started_at: ((_a = row.started_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                expired_at: '',
                                canceled_at: '',
                                days_remaining: 0,
                                total_spent: parseFloat(row.amount) || 0,
                                transaction_count: 1,
                            });
                        })];
                case 3:
                    error_13 = _a.sent();
                    logger_1.logger.error('Error fetching first purchase details:', error_13);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ============ CONVERSION RATE ============
function getConversionTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        var periodStart, query, result, error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n      WITH daily_stats AS (\n        SELECT \n          d.date,\n          COALESCE(signups.count, 0) as signups,\n          COALESCE(conversions.count, 0) as conversions,\n          COALESCE(signups_ios.count, 0) as signups_ios,\n          COALESCE(conversions_ios.count, 0) as conversions_ios,\n          COALESCE(signups_android.count, 0) as signups_android,\n          COALESCE(conversions_android.count, 0) as conversions_android\n        FROM (\n          SELECT generate_series($1::date, CURRENT_DATE, '1 day'::interval)::date as date\n        ) d\n        LEFT JOIN (\n          SELECT DATE(created_at) as date, COUNT(*) as count \n          FROM customer_users \n          WHERE created_at >= $1\n          GROUP BY DATE(created_at)\n        ) signups ON signups.date = d.date\n        LEFT JOIN (\n          SELECT DATE(cs.created_at) as date, COUNT(*) as count \n          FROM customer_subscriptions cs\n          WHERE cs.created_at >= $1 AND cs.status NOT IN ('trial')\n          GROUP BY DATE(cs.created_at)\n        ) conversions ON conversions.date = d.date\n        LEFT JOIN (\n          SELECT DATE(created_at) as date, COUNT(*) as count \n          FROM customer_users \n          WHERE created_at >= $1 AND platform IN ('ios', 'apple')\n          GROUP BY DATE(created_at)\n        ) signups_ios ON signups_ios.date = d.date\n        LEFT JOIN (\n          SELECT DATE(cs.created_at) as date, COUNT(*) as count \n          FROM customer_subscriptions cs\n          WHERE cs.created_at >= $1 AND cs.status NOT IN ('trial') AND cs.platform IN ('ios', 'apple')\n          GROUP BY DATE(cs.created_at)\n        ) conversions_ios ON conversions_ios.date = d.date\n        LEFT JOIN (\n          SELECT DATE(created_at) as date, COUNT(*) as count \n          FROM customer_users \n          WHERE created_at >= $1 AND platform IN ('android', 'google')\n          GROUP BY DATE(created_at)\n        ) signups_android ON signups_android.date = d.date\n        LEFT JOIN (\n          SELECT DATE(cs.created_at) as date, COUNT(*) as count \n          FROM customer_subscriptions cs\n          WHERE cs.created_at >= $1 AND cs.status NOT IN ('trial') AND cs.platform IN ('android', 'google')\n          GROUP BY DATE(cs.created_at)\n        ) conversions_android ON conversions_android.date = d.date\n      )\n      SELECT \n        date,\n        CASE WHEN signups > 0 THEN ROUND((conversions::numeric / signups::numeric) * 100, 1) ELSE 0 END as total,\n        CASE WHEN signups_ios > 0 THEN ROUND((conversions_ios::numeric / signups_ios::numeric) * 100, 1) ELSE 0 END as ios,\n        CASE WHEN signups_android > 0 THEN ROUND((conversions_android::numeric / signups_android::numeric) * 100, 1) ELSE 0 END as android\n      FROM daily_stats\n      ORDER BY date ASC\n    ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                date: ((_b = (_a = row.date) === null || _a === void 0 ? void 0 : _a.toISOString()) === null || _b === void 0 ? void 0 : _b.split('T')[0]) || '',
                                total: parseFloat(row.total) || 0,
                                ios: parseFloat(row.ios) || 0,
                                android: parseFloat(row.android) || 0,
                            });
                        })];
                case 3:
                    error_14 = _a.sent();
                    logger_1.logger.error('Error fetching conversion trend:', error_14);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getConversionDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var periodStart, query, result, error_15;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    query = "\n      SELECT \n        cu.id as user_id,\n        cu.email,\n        cu.full_name,\n        cu.phone,\n        cu.platform,\n        cu.created_at as signup_at,\n        cs.created_at as conversion_at,\n        sp.plan_name,\n        cs.amount,\n        EXTRACT(DAY FROM (cs.created_at - cu.created_at)) as days_to_convert\n      FROM customer_users cu\n      INNER JOIN customer_subscriptions cs ON cs.customer_user_id = cu.id\n      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id\n      WHERE cu.created_at >= $1\n        AND cs.status NOT IN ('trial')\n        AND cs.created_at = (\n          SELECT MIN(cs2.created_at) \n          FROM customer_subscriptions cs2 \n          WHERE cs2.customer_user_id = cu.id AND cs2.status NOT IN ('trial')\n        )\n      ORDER BY cs.created_at DESC\n      LIMIT $2\n    ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart, limit])];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                id: row.user_id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: row.plan_name || 'Unknown',
                                amount: parseFloat(row.amount) || 0,
                                status: 'converted',
                                started_at: ((_a = row.conversion_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                expired_at: '',
                                canceled_at: '',
                                days_remaining: parseInt(row.days_to_convert) || 0, // Days to convert
                                total_spent: parseFloat(row.amount) || 0,
                                transaction_count: 1,
                                created_at: ((_b = row.signup_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                            });
                        })];
                case 3:
                    error_15 = _a.sent();
                    logger_1.logger.error('Error fetching conversion details:', error_15);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ============ TOTAL MEMBERS ============
function getTotalMembersTrend(period) {
    return __awaiter(this, void 0, void 0, function () {
        var periodStart, query, result, runningTotal_1, runningIos_1, runningAndroid_1, baseQuery, baseResult, error_16;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    periodStart = getPeriodDates(period).periodStart;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    query = "\n      SELECT \n        DATE(created_at) as date,\n        COUNT(*) as daily_new,\n        COUNT(CASE WHEN platform IN ('ios', 'apple') THEN 1 END) as ios,\n        COUNT(CASE WHEN platform IN ('android', 'google') THEN 1 END) as android\n      FROM customer_users\n      WHERE created_at >= $1\n      GROUP BY DATE(created_at)\n      ORDER BY date ASC\n    ";
                    return [4 /*yield*/, connection_1.pool.query(query, [periodStart])];
                case 2:
                    result = _b.sent();
                    runningTotal_1 = 0;
                    runningIos_1 = 0;
                    runningAndroid_1 = 0;
                    baseQuery = "SELECT COUNT(*) as count FROM customer_users WHERE created_at < $1";
                    return [4 /*yield*/, connection_1.pool.query(baseQuery, [periodStart])];
                case 3:
                    baseResult = _b.sent();
                    runningTotal_1 = parseInt((_a = baseResult.rows[0]) === null || _a === void 0 ? void 0 : _a.count) || 0;
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            runningTotal_1 += parseInt(row.daily_new) || 0;
                            runningIos_1 += parseInt(row.ios) || 0;
                            runningAndroid_1 += parseInt(row.android) || 0;
                            return {
                                date: ((_b = (_a = row.date) === null || _a === void 0 ? void 0 : _a.toISOString()) === null || _b === void 0 ? void 0 : _b.split('T')[0]) || '',
                                total: runningTotal_1,
                                ios: runningIos_1,
                                android: runningAndroid_1,
                            };
                        })];
                case 4:
                    error_16 = _b.sent();
                    logger_1.logger.error('Error fetching total members trend:', error_16);
                    return [2 /*return*/, []];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getTotalMembersDetails(period_1) {
    return __awaiter(this, arguments, void 0, function (period, limit) {
        var query, result, error_17;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    query = "\n      SELECT \n        cu.id as user_id,\n        cu.email,\n        cu.full_name,\n        cu.phone,\n        cu.platform,\n        cu.created_at,\n        cu.last_seen_at,\n        COALESCE(subs.total_spent, 0) as total_spent,\n        COALESCE(subs.transaction_count, 0) as transaction_count,\n        subs.latest_plan\n      FROM customer_users cu\n      LEFT JOIN (\n        SELECT \n          customer_user_id,\n          SUM(amount) as total_spent,\n          COUNT(*) as transaction_count,\n          MAX(plan_id) as latest_plan\n        FROM customer_subscriptions\n        WHERE status != 'trial'\n        GROUP BY customer_user_id\n      ) subs ON subs.customer_user_id = cu.id\n      ORDER BY cu.created_at DESC\n      LIMIT $1\n    ";
                    return [4 /*yield*/, connection_1.pool.query(query, [limit])];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows.map(function (row) {
                            var _a, _b;
                            return ({
                                id: row.user_id,
                                user_id: row.user_id,
                                email: row.email || '',
                                full_name: row.full_name || '',
                                phone: row.phone || '',
                                platform: row.platform || 'unknown',
                                plan_name: '',
                                amount: 0,
                                status: row.total_spent > 0 ? 'paying' : 'free',
                                started_at: '',
                                expired_at: '',
                                canceled_at: '',
                                days_remaining: 0,
                                total_spent: parseFloat(row.total_spent) || 0,
                                transaction_count: parseInt(row.transaction_count) || 0,
                                created_at: ((_a = row.created_at) === null || _a === void 0 ? void 0 : _a.toISOString()) || '',
                                last_seen_at: ((_b = row.last_seen_at) === null || _b === void 0 ? void 0 : _b.toISOString()) || '',
                            });
                        })];
                case 2:
                    error_17 = _a.sent();
                    logger_1.logger.error('Error fetching total members details:', error_17);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}

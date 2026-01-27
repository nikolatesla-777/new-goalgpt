"use strict";
/**
 * Dashboard Controller
 * Handles dashboard API requests
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
exports.getDashboardStatsHandler = getDashboardStatsHandler;
exports.getRevenueChartHandler = getRevenueChartHandler;
exports.getTrendHandler = getTrendHandler;
exports.getDetailsHandler = getDetailsHandler;
var dashboard_service_1 = require("../services/dashboard.service");
var logger_1 = require("../utils/logger");
function getDashboardStatsHandler(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var period, stats, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    period = request.query.period || 'month';
                    return [4 /*yield*/, (0, dashboard_service_1.getDashboardStats)(period)];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, reply.send({
                            success: true,
                            data: stats,
                            period: period,
                        })];
                case 2:
                    error_1 = _a.sent();
                    logger_1.logger.error('Dashboard stats error:', error_1);
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: 'Failed to fetch dashboard stats',
                            message: error_1.message,
                        })];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getRevenueChartHandler(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var period, chartData, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    period = request.query.period || 'month';
                    return [4 /*yield*/, (0, dashboard_service_1.getRevenueChart)(period)];
                case 1:
                    chartData = _a.sent();
                    return [2 /*return*/, reply.send({
                            success: true,
                            data: chartData,
                            period: period,
                        })];
                case 2:
                    error_2 = _a.sent();
                    logger_1.logger.error('Revenue chart error:', error_2);
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: 'Failed to fetch revenue chart',
                            message: error_2.message,
                        })];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ==========================================
// DRILL-DOWN TREND HANDLERS
// ==========================================
function getTrendHandler(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var type, period, trendData, _a, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 25, , 26]);
                    type = request.params.type;
                    period = request.query.period || 'month';
                    trendData = void 0;
                    _a = type;
                    switch (_a) {
                        case 'revenue': return [3 /*break*/, 1];
                        case 'subscribers': return [3 /*break*/, 3];
                        case 'sales': return [3 /*break*/, 5];
                        case 'billing-errors': return [3 /*break*/, 7];
                        case 'signups': return [3 /*break*/, 9];
                        case 'trials': return [3 /*break*/, 11];
                        case 'cancellations': return [3 /*break*/, 13];
                        case 'churn': return [3 /*break*/, 15];
                        case 'first-purchase': return [3 /*break*/, 17];
                        case 'conversion': return [3 /*break*/, 19];
                        case 'total-members': return [3 /*break*/, 21];
                    }
                    return [3 /*break*/, 23];
                case 1: return [4 /*yield*/, (0, dashboard_service_1.getRevenueTrend)(period)];
                case 2:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 3: return [4 /*yield*/, (0, dashboard_service_1.getSubscribersTrend)(period)];
                case 4:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 5: return [4 /*yield*/, (0, dashboard_service_1.getSalesTrend)(period)];
                case 6:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 7: return [4 /*yield*/, (0, dashboard_service_1.getBillingErrorsTrend)(period)];
                case 8:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 9: return [4 /*yield*/, (0, dashboard_service_1.getSignupsTrend)(period)];
                case 10:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 11: return [4 /*yield*/, (0, dashboard_service_1.getTrialsTrend)(period)];
                case 12:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 13: return [4 /*yield*/, (0, dashboard_service_1.getCancellationsTrend)(period)];
                case 14:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 15: return [4 /*yield*/, (0, dashboard_service_1.getChurnTrend)(period)];
                case 16:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 17: return [4 /*yield*/, (0, dashboard_service_1.getFirstPurchaseTrend)(period)];
                case 18:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 19: return [4 /*yield*/, (0, dashboard_service_1.getConversionTrend)(period)];
                case 20:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 21: return [4 /*yield*/, (0, dashboard_service_1.getTotalMembersTrend)(period)];
                case 22:
                    trendData = _b.sent();
                    return [3 /*break*/, 24];
                case 23: return [2 /*return*/, reply.status(400).send({
                        success: false,
                        error: "Unknown trend type: ".concat(type),
                    })];
                case 24: return [2 /*return*/, reply.send({
                        success: true,
                        data: trendData,
                        period: period,
                        type: type,
                    })];
                case 25:
                    error_3 = _b.sent();
                    logger_1.logger.error('Trend data error:', error_3);
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: 'Failed to fetch trend data',
                            message: error_3.message,
                        })];
                case 26: return [2 /*return*/];
            }
        });
    });
}
// ==========================================
// DRILL-DOWN DETAILS HANDLERS
// ==========================================
function getDetailsHandler(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var type, period, limit, detailsData, _a, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 25, , 26]);
                    type = request.params.type;
                    period = request.query.period || 'month';
                    limit = parseInt(request.query.limit || '100');
                    detailsData = void 0;
                    _a = type;
                    switch (_a) {
                        case 'revenue': return [3 /*break*/, 1];
                        case 'subscribers': return [3 /*break*/, 3];
                        case 'sales': return [3 /*break*/, 5];
                        case 'billing-errors': return [3 /*break*/, 7];
                        case 'signups': return [3 /*break*/, 9];
                        case 'trials': return [3 /*break*/, 11];
                        case 'cancellations': return [3 /*break*/, 13];
                        case 'churn': return [3 /*break*/, 15];
                        case 'first-purchase': return [3 /*break*/, 17];
                        case 'conversion': return [3 /*break*/, 19];
                        case 'total-members': return [3 /*break*/, 21];
                    }
                    return [3 /*break*/, 23];
                case 1: return [4 /*yield*/, (0, dashboard_service_1.getRevenueDetails)(period, limit)];
                case 2:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 3: return [4 /*yield*/, (0, dashboard_service_1.getActiveSubscribersDetails)(period, limit)];
                case 4:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 5: return [4 /*yield*/, (0, dashboard_service_1.getRevenueDetails)(period, limit)];
                case 6:
                    detailsData = _b.sent(); // Same as revenue for now
                    return [3 /*break*/, 24];
                case 7: return [4 /*yield*/, (0, dashboard_service_1.getBillingErrorsDetails)(period, limit)];
                case 8:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 9: return [4 /*yield*/, (0, dashboard_service_1.getSignupsDetails)(period, limit)];
                case 10:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 11: return [4 /*yield*/, (0, dashboard_service_1.getTrialsDetails)(period, limit)];
                case 12:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 13: return [4 /*yield*/, (0, dashboard_service_1.getCancellationsDetails)(period, limit)];
                case 14:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 15: return [4 /*yield*/, (0, dashboard_service_1.getChurnDetails)(period, limit)];
                case 16:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 17: return [4 /*yield*/, (0, dashboard_service_1.getFirstPurchaseDetails)(period, limit)];
                case 18:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 19: return [4 /*yield*/, (0, dashboard_service_1.getConversionDetails)(period, limit)];
                case 20:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 21: return [4 /*yield*/, (0, dashboard_service_1.getTotalMembersDetails)(period, limit)];
                case 22:
                    detailsData = _b.sent();
                    return [3 /*break*/, 24];
                case 23: return [2 /*return*/, reply.status(400).send({
                        success: false,
                        error: "Unknown details type: ".concat(type),
                    })];
                case 24: return [2 /*return*/, reply.send({
                        success: true,
                        data: detailsData,
                        total: detailsData.length,
                        period: period,
                        type: type,
                    })];
                case 25:
                    error_4 = _b.sent();
                    logger_1.logger.error('Details data error:', error_4);
                    return [2 /*return*/, reply.status(500).send({
                            success: false,
                            error: 'Failed to fetch details data',
                            message: error_4.message,
                        })];
                case 26: return [2 /*return*/];
            }
        });
    });
}

"use strict";
/**
 * Daily Rewards Routes - Daily Gift Wheel API Endpoints
 *
 * 5 endpoints for daily rewards system
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
exports.dailyRewardsRoutes = dailyRewardsRoutes;
var dailyRewards_service_1 = require("../services/dailyRewards.service");
var auth_middleware_1 = require("../middleware/auth.middleware");
function dailyRewardsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * GET /api/daily-rewards/status
             * Get daily reward status for current user
             * Requires authentication
             */
            fastify.get('/status', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, status_1, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, dailyRewards_service_1.getDailyRewardStatus)(userId)];
                        case 1:
                            status_1 = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: status_1,
                                })];
                        case 2:
                            error_1 = _a.sent();
                            fastify.log.error('Get daily reward status error:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_STATUS_FAILED',
                                    message: error_1.message || 'Failed to get daily reward status',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/daily-rewards/claim
             * Claim today's daily reward
             * Requires authentication
             */
            fastify.post('/claim', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, result, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, dailyRewards_service_1.claimDailyReward)(userId)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: result.message,
                                    data: result.reward,
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('Claim daily reward error:', error_2);
                            if (error_2.message === 'Daily reward already claimed today') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'ALREADY_CLAIMED',
                                        message: 'Bugün zaten ödül aldın',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'CLAIM_FAILED',
                                    message: error_2.message || 'Failed to claim daily reward',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/daily-rewards/history
             * Get daily reward claim history
             * Query params: limit (default: 30)
             * Requires authentication
             */
            fastify.get('/history', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, limit, history_1, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            limit = Math.min(Number(request.query.limit) || 30, 100);
                            return [4 /*yield*/, (0, dailyRewards_service_1.getDailyRewardHistory)(userId, limit)];
                        case 1:
                            history_1 = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: history_1,
                                })];
                        case 2:
                            error_3 = _a.sent();
                            fastify.log.error('Get daily reward history error:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_HISTORY_FAILED',
                                    message: error_3.message || 'Failed to get reward history',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/daily-rewards/calendar
             * Get 7-day reward calendar
             * Public endpoint
             */
            fastify.get('/calendar', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var calendar;
                return __generator(this, function (_a) {
                    try {
                        calendar = (0, dailyRewards_service_1.getDailyRewardCalendar)();
                        return [2 /*return*/, reply.send({
                                success: true,
                                data: calendar,
                            })];
                    }
                    catch (error) {
                        fastify.log.error('Get reward calendar error:', error);
                        return [2 /*return*/, reply.status(500).send({
                                success: false,
                                error: 'GET_CALENDAR_FAILED',
                                message: error.message || 'Failed to get reward calendar',
                            })];
                    }
                    return [2 /*return*/];
                });
            }); });
            /**
             * GET /api/daily-rewards/stats
             * Get daily reward statistics (admin only)
             */
            fastify.get('/stats', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, dailyRewards_service_1.getDailyRewardStats)()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: stats,
                                })];
                        case 2:
                            error_4 = _a.sent();
                            fastify.log.error('Get daily reward stats error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_STATS_FAILED',
                                    message: error_4.message || 'Failed to get reward statistics',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

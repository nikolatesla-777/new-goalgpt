"use strict";
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
exports.xpRoutes = xpRoutes;
var auth_middleware_1 = require("../middleware/auth.middleware");
var xp_service_1 = require("../services/xp.service");
var logger_1 = require("../utils/logger");
function xpRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * GET /api/xp/me
             * Get current user's XP profile
             * Protected: Requires authentication
             */
            fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, xpData, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, xp_service_1.getUserXP)(userId)];
                        case 1:
                            xpData = _a.sent();
                            if (!xpData) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'USER_XP_NOT_FOUND',
                                        message: 'User XP record not found',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: xpData,
                                })];
                        case 2:
                            error_1 = _a.sent();
                            logger_1.logger.error('Error fetching user XP:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'INTERNAL_ERROR',
                                    message: error_1.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/xp/grant
             * Grant XP to a user (admin only)
             * Protected: Requires authentication + admin role
             */
            fastify.post('/grant', { preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, userId, amount, transactionType, description, referenceId, referenceType, metadata, result, error_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.body, userId = _a.userId, amount = _a.amount, transactionType = _a.transactionType, description = _a.description, referenceId = _a.referenceId, referenceType = _a.referenceType, metadata = _a.metadata;
                            return [4 /*yield*/, (0, xp_service_1.grantXP)({
                                    userId: userId,
                                    amount: amount,
                                    transactionType: transactionType,
                                    description: description,
                                    referenceId: referenceId,
                                    referenceType: referenceType,
                                    metadata: metadata,
                                })];
                        case 1:
                            result = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: result,
                                })];
                        case 2:
                            error_2 = _b.sent();
                            logger_1.logger.error('Error granting XP:', error_2);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GRANT_XP_FAILED',
                                    message: error_2.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/xp/transactions
             * Get current user's XP transaction history
             * Protected: Requires authentication
             */
            fastify.get('/transactions', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, limit, offset, transactions, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            limit = parseInt(request.query.limit || '50', 10);
                            offset = parseInt(request.query.offset || '0', 10);
                            return [4 /*yield*/, (0, xp_service_1.getXPTransactions)(userId, limit, offset)];
                        case 1:
                            transactions = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: transactions,
                                    pagination: {
                                        limit: limit,
                                        offset: offset,
                                        count: transactions.length,
                                    },
                                })];
                        case 2:
                            error_3 = _a.sent();
                            logger_1.logger.error('Error fetching XP transactions:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_TRANSACTIONS_FAILED',
                                    message: error_3.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/xp/login-streak
             * Update daily login streak for current user
             * Protected: Requires authentication
             */
            fastify.post('/login-streak', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, streakResult, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, xp_service_1.updateLoginStreak)(userId)];
                        case 1:
                            streakResult = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: streakResult,
                                    message: streakResult.xpGranted > 0
                                        ? "G\u00FCnl\u00FCk giri\u015F bonusu kazand\u0131n! ".concat(streakResult.xpGranted, " XP")
                                        : 'Bugün zaten giriş yaptın',
                                })];
                        case 2:
                            error_4 = _a.sent();
                            logger_1.logger.error('Error updating login streak:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'UPDATE_STREAK_FAILED',
                                    message: error_4.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/xp/leaderboard
             * Get global XP leaderboard
             * Public: No authentication required
             */
            fastify.get('/leaderboard', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, leaderboard, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = parseInt(request.query.limit || '100', 10);
                            return [4 /*yield*/, (0, xp_service_1.getXPLeaderboard)(limit)];
                        case 1:
                            leaderboard = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: leaderboard,
                                })];
                        case 2:
                            error_5 = _a.sent();
                            logger_1.logger.error('Error fetching XP leaderboard:', error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_LEADERBOARD_FAILED',
                                    message: error_5.message,
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

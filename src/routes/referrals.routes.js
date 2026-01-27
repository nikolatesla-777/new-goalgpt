"use strict";
/**
 * Referral Routes - Referral Program API Endpoints
 *
 * 8 endpoints for referral system
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
exports.referralsRoutes = referralsRoutes;
var referrals_service_1 = require("../services/referrals.service");
var auth_middleware_1 = require("../middleware/auth.middleware");
function referralsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * GET /api/referrals/me/code
             * Get user's referral code (create if doesn't exist)
             * Requires authentication
             */
            fastify.get('/me/code', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, referralCode, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, referrals_service_1.getUserReferralCode)(userId)];
                        case 1:
                            referralCode = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: {
                                        referralCode: referralCode,
                                        shareUrl: "https://goalgpt.app/signup?ref=".concat(referralCode),
                                        shareMessage: "GoalGPT'ye kat\u0131l ve ".concat(referralCode, " kodumu kullan! \uD83C\uDF89"),
                                    },
                                })];
                        case 2:
                            error_1 = _a.sent();
                            fastify.log.error('Get referral code error:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_REFERRAL_CODE_FAILED',
                                    message: error_1.message || 'Failed to get referral code',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/referrals/apply
             * Apply referral code during signup (Tier 1)
             * Requires authentication (for new user)
             * Body: { referralCode: string }
             */
            fastify.post('/apply', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, referralCode, result, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            referralCode = request.body.referralCode;
                            if (!referralCode) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'referralCode is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, referrals_service_1.applyReferralCode)(userId, referralCode.toUpperCase())];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Referral code applied successfully',
                                    data: result.referral,
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('Apply referral code error:', error_2);
                            // Handle specific errors
                            if (error_2.message === 'Invalid referral code') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REFERRAL_CODE',
                                        message: 'Geçersiz referral kodu',
                                    })];
                            }
                            if (error_2.message === 'Cannot refer yourself') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'SELF_REFERRAL',
                                        message: 'Kendi kodunu kullanamazsın',
                                    })];
                            }
                            if (error_2.message === 'User already has a referral') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'ALREADY_REFERRED',
                                        message: 'Zaten bir referral kodun var',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'APPLY_REFERRAL_FAILED',
                                    message: error_2.message || 'Failed to apply referral code',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/referrals/me/stats
             * Get user's referral statistics
             * Requires authentication
             */
            fastify.get('/me/stats', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, stats, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, referrals_service_1.getReferralStats)(userId)];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: stats,
                                })];
                        case 2:
                            error_3 = _a.sent();
                            fastify.log.error('Get referral stats error:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_STATS_FAILED',
                                    message: error_3.message || 'Failed to get referral statistics',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/referrals/me/referrals
             * Get user's referral list
             * Query params: limit (default: 50), offset (default: 0)
             * Requires authentication
             */
            fastify.get('/me/referrals', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, limit, offset, referrals, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            limit = Math.min(Number(request.query.limit) || 50, 100);
                            offset = Number(request.query.offset) || 0;
                            return [4 /*yield*/, (0, referrals_service_1.getUserReferrals)(userId, limit, offset)];
                        case 1:
                            referrals = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: referrals,
                                    pagination: {
                                        limit: limit,
                                        offset: offset,
                                        total: referrals.length,
                                    },
                                })];
                        case 2:
                            error_4 = _a.sent();
                            fastify.log.error('Get referrals error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_REFERRALS_FAILED',
                                    message: error_4.message || 'Failed to get referrals',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/referrals/leaderboard
             * Get referral leaderboard (top referrers)
             * Query params: limit (default: 100, max: 500)
             */
            fastify.get('/leaderboard', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, leaderboard, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = Math.min(Number(request.query.limit) || 100, 500);
                            return [4 /*yield*/, (0, referrals_service_1.getReferralLeaderboard)(limit)];
                        case 1:
                            leaderboard = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: leaderboard,
                                })];
                        case 2:
                            error_5 = _a.sent();
                            fastify.log.error('Get referral leaderboard error:', error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_LEADERBOARD_FAILED',
                                    message: error_5.message || 'Failed to get referral leaderboard',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/referrals/validate
             * Validate referral code
             * Body: { code: string }
             * Public endpoint (no auth required)
             */
            fastify.post('/validate', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var code, result, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            code = request.body.code;
                            if (!code) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'code is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, referrals_service_1.validateReferralCode)(code.toUpperCase())];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: {
                                        valid: result.valid,
                                        message: result.valid ? 'Geçerli referral kodu' : 'Geçersiz referral kodu',
                                    },
                                })];
                        case 2:
                            error_6 = _a.sent();
                            fastify.log.error('Validate referral code error:', error_6);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'VALIDATE_CODE_FAILED',
                                    message: error_6.message || 'Failed to validate referral code',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/referrals/tier2/:userId
             * Process Tier 2 reward (first login)
             * Admin only - manual trigger
             */
            fastify.post('/tier2/:userId', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, success, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.params.userId;
                            return [4 /*yield*/, (0, referrals_service_1.processReferralTier2)(userId)];
                        case 1:
                            success = _a.sent();
                            if (!success) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NO_REFERRAL_FOUND',
                                        message: 'No active Tier 1 referral found for this user',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Tier 2 reward processed successfully',
                                })];
                        case 2:
                            error_7 = _a.sent();
                            fastify.log.error('Process Tier 2 error:', error_7);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'PROCESS_TIER2_FAILED',
                                    message: error_7.message || 'Failed to process Tier 2 reward',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/referrals/tier3/:userId
             * Process Tier 3 reward (subscription purchase)
             * Admin only - manual trigger
             */
            fastify.post('/tier3/:userId', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, success, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.params.userId;
                            return [4 /*yield*/, (0, referrals_service_1.processReferralTier3)(userId)];
                        case 1:
                            success = _a.sent();
                            if (!success) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NO_REFERRAL_FOUND',
                                        message: 'No active Tier 2 referral found for this user',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Tier 3 reward processed successfully',
                                })];
                        case 2:
                            error_8 = _a.sent();
                            fastify.log.error('Process Tier 3 error:', error_8);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'PROCESS_TIER3_FAILED',
                                    message: error_8.message || 'Failed to process Tier 3 reward',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

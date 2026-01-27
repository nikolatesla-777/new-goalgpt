"use strict";
/**
 * Badge Routes - Achievement and Badge Management
 *
 * 7 endpoints for badge system
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
exports.badgesRoutes = badgesRoutes;
var badges_service_1 = require("../services/badges.service");
var auth_middleware_1 = require("../middleware/auth.middleware");
function badgesRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * GET /api/badges
             * Get all active badges
             * Query params: category, rarity
             */
            fastify.get('/', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, category, rarity, badges, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.query, category = _a.category, rarity = _a.rarity;
                            return [4 /*yield*/, (0, badges_service_1.getAllBadges)(category, rarity)];
                        case 1:
                            badges = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: badges,
                                })];
                        case 2:
                            error_1 = _b.sent();
                            fastify.log.error('Get all badges error:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_BADGES_FAILED',
                                    message: error_1.message || 'Failed to fetch badges',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/badges/:slug
             * Get badge details by slug
             */
            fastify.get('/:slug', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var slug, badge, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            slug = request.params.slug;
                            return [4 /*yield*/, (0, badges_service_1.getBadgeBySlug)(slug)];
                        case 1:
                            badge = _a.sent();
                            if (!badge) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'BADGE_NOT_FOUND',
                                        message: "Badge '".concat(slug, "' not found"),
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: badge,
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('Get badge error:', error_2);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_BADGE_FAILED',
                                    message: error_2.message || 'Failed to fetch badge',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/badges/user/me
             * Get current user's badges
             * Requires authentication
             */
            fastify.get('/user/me', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, badges, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, badges_service_1.getUserBadges)(userId)];
                        case 1:
                            badges = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: badges,
                                })];
                        case 2:
                            error_3 = _a.sent();
                            fastify.log.error('Get user badges error:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_USER_BADGES_FAILED',
                                    message: error_3.message || 'Failed to fetch user badges',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/badges/unlock
             * Unlock badge for user (admin only)
             * Body: { userId, badgeSlug, metadata }
             */
            fastify.post('/unlock', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, userId, badgeSlug, metadata, result, error_4;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.body, userId = _a.userId, badgeSlug = _a.badgeSlug, metadata = _a.metadata;
                            if (!userId || !badgeSlug) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'userId and badgeSlug are required',
                                    })];
                            }
                            return [4 /*yield*/, (0, badges_service_1.unlockBadge)(userId, badgeSlug, metadata)];
                        case 1:
                            result = _b.sent();
                            if (result.alreadyUnlocked) {
                                return [2 /*return*/, reply.status(200).send({
                                        success: true,
                                        message: 'Badge already unlocked',
                                        alreadyUnlocked: true,
                                        badge: result.badge,
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: "Badge '".concat(badgeSlug, "' unlocked successfully"),
                                    badge: result.badge,
                                })];
                        case 2:
                            error_4 = _b.sent();
                            fastify.log.error('Unlock badge error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'UNLOCK_BADGE_FAILED',
                                    message: error_4.message || 'Failed to unlock badge',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/badges/claim
             * Claim badge rewards (mark as claimed)
             * Body: { badgeId }
             * Requires authentication
             */
            fastify.post('/claim', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, badgeId, result, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            badgeId = request.body.badgeId;
                            if (!badgeId) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'badgeId is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, badges_service_1.claimBadge)(userId, badgeId)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Badge rewards claimed successfully',
                                })];
                        case 2:
                            error_5 = _a.sent();
                            fastify.log.error('Claim badge error:', error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'CLAIM_BADGE_FAILED',
                                    message: error_5.message || 'Failed to claim badge',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/badges/toggle-display
             * Display or hide badge on profile
             * Body: { badgeId, isDisplayed }
             * Requires authentication
             */
            fastify.post('/toggle-display', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, _a, badgeId, isDisplayed, result, error_6;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            _a = request.body, badgeId = _a.badgeId, isDisplayed = _a.isDisplayed;
                            if (!badgeId || typeof isDisplayed !== 'boolean') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'badgeId and isDisplayed (boolean) are required',
                                    })];
                            }
                            return [4 /*yield*/, (0, badges_service_1.toggleBadgeDisplay)(userId, badgeId, isDisplayed)];
                        case 1:
                            result = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: isDisplayed
                                        ? 'Badge is now displayed on your profile'
                                        : 'Badge is now hidden from your profile',
                                })];
                        case 2:
                            error_6 = _b.sent();
                            fastify.log.error('Toggle badge display error:', error_6);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'TOGGLE_BADGE_FAILED',
                                    message: error_6.message || 'Failed to toggle badge display',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/badges/stats
             * Get badge system statistics
             */
            fastify.get('/stats', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, badges_service_1.getBadgeStats)()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: stats,
                                })];
                        case 2:
                            error_7 = _a.sent();
                            fastify.log.error('Get badge stats error:', error_7);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_STATS_FAILED',
                                    message: error_7.message || 'Failed to fetch badge statistics',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/badges/leaderboard
             * Get top badge collectors
             * Query params: limit (default: 100)
             */
            fastify.get('/leaderboard', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, leaderboard, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = Math.min(Number(request.query.limit) || 100, 500);
                            return [4 /*yield*/, (0, badges_service_1.getBadgeLeaderboard)(limit)];
                        case 1:
                            leaderboard = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: leaderboard,
                                })];
                        case 2:
                            error_8 = _a.sent();
                            fastify.log.error('Get badge leaderboard error:', error_8);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'FETCH_LEADERBOARD_FAILED',
                                    message: error_8.message || 'Failed to fetch badge leaderboard',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

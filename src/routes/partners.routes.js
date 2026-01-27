"use strict";
/**
 * Partner Routes - Partner/Bayi Program API Endpoints
 *
 * 11 endpoints for partner management
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
exports.partnersRoutes = partnersRoutes;
var partners_service_1 = require("../services/partners.service");
var auth_middleware_1 = require("../middleware/auth.middleware");
function partnersRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * POST /api/partners/apply
             * Apply for partnership program
             * Requires authentication
             * Body: { businessName, taxId?, phone, email, address?, notes? }
             */
            fastify.post('/apply', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, _a, businessName, taxId, phone, email, address, notes, partner, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            _a = request.body, businessName = _a.businessName, taxId = _a.taxId, phone = _a.phone, email = _a.email, address = _a.address, notes = _a.notes;
                            if (!businessName || !phone || !email) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'businessName, phone, and email are required',
                                    })];
                            }
                            return [4 /*yield*/, (0, partners_service_1.applyForPartnership)({
                                    userId: userId,
                                    businessName: businessName,
                                    taxId: taxId,
                                    phone: phone,
                                    email: email,
                                    address: address,
                                    notes: notes,
                                })];
                        case 1:
                            partner = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Partnership application submitted successfully',
                                    data: partner,
                                })];
                        case 2:
                            error_1 = _b.sent();
                            fastify.log.error('Apply for partnership error:', error_1);
                            if (error_1.message === 'User already has a partner account') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'ALREADY_PARTNER',
                                        message: 'Zaten bir partner hesabın var',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'APPLY_FAILED',
                                    message: error_1.message || 'Failed to apply for partnership',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/partners/me
             * Get user's partner profile
             * Requires authentication
             */
            fastify.get('/me', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, partner, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, partners_service_1.getPartnerByUserId)(userId)];
                        case 1:
                            partner = _a.sent();
                            if (!partner) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_A_PARTNER',
                                        message: 'Partner hesabı bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: partner,
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('Get partner profile error:', error_2);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_PARTNER_FAILED',
                                    message: error_2.message || 'Failed to get partner profile',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/partners/me/stats
             * Get partner statistics
             * Requires authentication (partner only)
             */
            fastify.get('/me/stats', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, partner, stats, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, partners_service_1.getPartnerByUserId)(userId)];
                        case 1:
                            partner = _a.sent();
                            if (!partner) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_A_PARTNER',
                                        message: 'Partner hesabı bulunamadı',
                                    })];
                            }
                            return [4 /*yield*/, (0, partners_service_1.getPartnerStats)(partner.id)];
                        case 2:
                            stats = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: stats,
                                })];
                        case 3:
                            error_3 = _a.sent();
                            fastify.log.error('Get partner stats error:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_STATS_FAILED',
                                    message: error_3.message || 'Failed to get partner statistics',
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/partners/me/analytics
             * Get partner analytics (daily breakdown)
             * Query params: startDate, endDate
             * Requires authentication (partner only)
             */
            fastify.get('/me/analytics', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, partner, endDate, startDate, analytics, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            userId = request.user.userId;
                            return [4 /*yield*/, (0, partners_service_1.getPartnerByUserId)(userId)];
                        case 1:
                            partner = _a.sent();
                            if (!partner) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_A_PARTNER',
                                        message: 'Partner hesabı bulunamadı',
                                    })];
                            }
                            endDate = request.query.endDate
                                ? new Date(request.query.endDate)
                                : new Date();
                            startDate = request.query.startDate
                                ? new Date(request.query.startDate)
                                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            return [4 /*yield*/, (0, partners_service_1.getPartnerAnalytics)(partner.id, startDate, endDate)];
                        case 2:
                            analytics = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: analytics,
                                })];
                        case 3:
                            error_4 = _a.sent();
                            fastify.log.error('Get partner analytics error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_ANALYTICS_FAILED',
                                    message: error_4.message || 'Failed to get partner analytics',
                                })];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/partners
             * Get all partners (admin only)
             * Query params: status, limit, offset
             */
            fastify.get('/', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, status_1, limit, offset, partners, error_5;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            _a = request.query, status_1 = _a.status, limit = _a.limit, offset = _a.offset;
                            return [4 /*yield*/, (0, partners_service_1.getAllPartners)(status_1, Math.min(Number(limit) || 50, 100), Number(offset) || 0)];
                        case 1:
                            partners = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: partners,
                                })];
                        case 2:
                            error_5 = _b.sent();
                            fastify.log.error('Get partners error:', error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_PARTNERS_FAILED',
                                    message: error_5.message || 'Failed to get partners',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/partners/pending
             * Get pending partner applications (admin only)
             */
            fastify.get('/pending', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var applications, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, partners_service_1.getPendingApplications)(50)];
                        case 1:
                            applications = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: applications,
                                })];
                        case 2:
                            error_6 = _a.sent();
                            fastify.log.error('Get pending applications error:', error_6);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_PENDING_FAILED',
                                    message: error_6.message || 'Failed to get pending applications',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/partners/:id/approve
             * Approve partner application (admin only)
             * Body: { notes? }
             */
            fastify.post('/:id/approve', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, adminId, notes, partner, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            adminId = request.user.userId;
                            notes = request.body.notes;
                            return [4 /*yield*/, (0, partners_service_1.approvePartner)(id, adminId, notes)];
                        case 1:
                            partner = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Partner approved successfully',
                                    data: partner,
                                })];
                        case 2:
                            error_7 = _a.sent();
                            fastify.log.error('Approve partner error:', error_7);
                            if (error_7.message === 'Partner not found or already processed') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Partner bulunamadı veya zaten işlendi',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'APPROVE_FAILED',
                                    message: error_7.message || 'Failed to approve partner',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/partners/:id/reject
             * Reject partner application (admin only)
             * Body: { reason }
             */
            fastify.post('/:id/reject', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, adminId, reason, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            adminId = request.user.userId;
                            reason = request.body.reason;
                            if (!reason) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'reason is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, partners_service_1.rejectPartner)(id, adminId, reason)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Partner rejected successfully',
                                })];
                        case 2:
                            error_8 = _a.sent();
                            fastify.log.error('Reject partner error:', error_8);
                            if (error_8.message === 'Partner not found or already processed') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Partner bulunamadı veya zaten işlendi',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'REJECT_FAILED',
                                    message: error_8.message || 'Failed to reject partner',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/partners/:id/suspend
             * Suspend partner account (admin only)
             * Body: { reason }
             */
            fastify.post('/:id/suspend', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, reason, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            reason = request.body.reason;
                            if (!reason) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'reason is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, partners_service_1.suspendPartner)(id, reason)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Partner suspended successfully',
                                })];
                        case 2:
                            error_9 = _a.sent();
                            fastify.log.error('Suspend partner error:', error_9);
                            if (error_9.message === 'Partner not found or not approved') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Partner bulunamadı veya onaylı değil',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'SUSPEND_FAILED',
                                    message: error_9.message || 'Failed to suspend partner',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/partners/:id/reactivate
             * Reactivate suspended partner (admin only)
             */
            fastify.post('/:id/reactivate', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            return [4 /*yield*/, (0, partners_service_1.reactivatePartner)(id)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Partner reactivated successfully',
                                })];
                        case 2:
                            error_10 = _a.sent();
                            fastify.log.error('Reactivate partner error:', error_10);
                            if (error_10.message === 'Partner not found or not suspended') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Partner bulunamadı veya suspend değil',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'REACTIVATE_FAILED',
                                    message: error_10.message || 'Failed to reactivate partner',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * PATCH /api/partners/:id/commission
             * Update partner commission rate (admin only)
             * Body: { commissionRate }
             */
            fastify.patch('/:id/commission', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, commissionRate, error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            commissionRate = request.body.commissionRate;
                            if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'commissionRate must be a number between 0 and 100',
                                    })];
                            }
                            return [4 /*yield*/, (0, partners_service_1.updateCommissionRate)(id, commissionRate)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Commission rate updated successfully',
                                })];
                        case 2:
                            error_11 = _a.sent();
                            fastify.log.error('Update commission rate error:', error_11);
                            if (error_11.message === 'Partner not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Partner bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'UPDATE_FAILED',
                                    message: error_11.message || 'Failed to update commission rate',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

"use strict";
/**
 * Announcements Routes - Admin Popup Management API
 *
 * Admin Endpoints:
 * - POST   /api/announcements              - Create announcement
 * - GET    /api/announcements              - List all announcements
 * - GET    /api/announcements/:id          - Get announcement by ID
 * - PUT    /api/announcements/:id          - Update announcement
 * - DELETE /api/announcements/:id          - Delete announcement
 * - POST   /api/announcements/:id/activate - Activate announcement
 * - GET    /api/announcements/stats        - Get statistics
 *
 * Mobile Endpoints:
 * - GET    /api/announcements/active       - Get active announcements for user
 * - POST   /api/announcements/:id/dismiss  - Dismiss announcement
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
exports.announcementsRoutes = announcementsRoutes;
var auth_middleware_1 = require("../middleware/auth.middleware");
var announcements_service_1 = require("../services/announcements.service");
// ============================================================================
// ROUTES
// ============================================================================
function announcementsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            // ==========================================================================
            // ADMIN ROUTES
            // ==========================================================================
            /**
             * POST /api/announcements
             * Create a new announcement
             */
            fastify.post('/', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var adminUserId, announcement, error_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            adminUserId = (_a = request.user) === null || _a === void 0 ? void 0 : _a.userId;
                            return [4 /*yield*/, (0, announcements_service_1.createAnnouncement)(request.body, adminUserId)];
                        case 1:
                            announcement = _b.sent();
                            return [2 /*return*/, reply.status(201).send({
                                    success: true,
                                    message: 'Duyuru oluşturuldu',
                                    data: announcement,
                                })];
                        case 2:
                            error_1 = _b.sent();
                            fastify.log.error('Create announcement error:', error_1);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'CREATE_ANNOUNCEMENT_FAILED',
                                    message: error_1.message || 'Duyuru oluşturulamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/announcements
             * List all announcements (admin)
             */
            fastify.get('/', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var limit, offset, announcements, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            limit = Math.min(Number(request.query.limit) || 50, 100);
                            offset = Number(request.query.offset) || 0;
                            return [4 /*yield*/, (0, announcements_service_1.getAllAnnouncements)(limit, offset)];
                        case 1:
                            announcements = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: announcements,
                                    pagination: { limit: limit, offset: offset, count: announcements.length },
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('List announcements error:', error_2);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'LIST_ANNOUNCEMENTS_FAILED',
                                    message: error_2.message || 'Duyurular listelenemedi',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/announcements/stats
             * Get announcement statistics (admin)
             */
            fastify.get('/stats', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var stats, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, announcements_service_1.getAnnouncementStats)()];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: stats,
                                })];
                        case 2:
                            error_3 = _a.sent();
                            fastify.log.error('Get announcement stats error:', error_3);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_STATS_FAILED',
                                    message: error_3.message || 'İstatistikler alınamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/announcements/active
             * Get active announcements for mobile user
             */
            fastify.get('/active', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, isVip, announcements, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            isVip = false;
                            return [4 /*yield*/, (0, announcements_service_1.getActiveAnnouncementsForUser)(userId, isVip)];
                        case 1:
                            announcements = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: announcements,
                                })];
                        case 2:
                            error_4 = _a.sent();
                            fastify.log.error('Get active announcements error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_ACTIVE_ANNOUNCEMENTS_FAILED',
                                    message: error_4.message || 'Duyurular alınamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/announcements/:id
             * Get announcement by ID (admin)
             */
            fastify.get('/:id', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, announcement, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            return [4 /*yield*/, (0, announcements_service_1.getAnnouncementById)(id)];
                        case 1:
                            announcement = _a.sent();
                            if (!announcement) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'ANNOUNCEMENT_NOT_FOUND',
                                        message: 'Duyuru bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: announcement,
                                })];
                        case 2:
                            error_5 = _a.sent();
                            fastify.log.error('Get announcement error:', error_5);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_ANNOUNCEMENT_FAILED',
                                    message: error_5.message || 'Duyuru alınamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * PUT /api/announcements/:id
             * Update an announcement (admin)
             */
            fastify.put('/:id', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, announcement, error_6;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            return [4 /*yield*/, (0, announcements_service_1.updateAnnouncement)(id, request.body)];
                        case 1:
                            announcement = _a.sent();
                            if (!announcement) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'ANNOUNCEMENT_NOT_FOUND',
                                        message: 'Duyuru bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Duyuru güncellendi',
                                    data: announcement,
                                })];
                        case 2:
                            error_6 = _a.sent();
                            fastify.log.error('Update announcement error:', error_6);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'UPDATE_ANNOUNCEMENT_FAILED',
                                    message: error_6.message || 'Duyuru güncellenemedi',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * DELETE /api/announcements/:id
             * Delete an announcement (admin)
             */
            fastify.delete('/:id', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, deleted, error_7;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            return [4 /*yield*/, (0, announcements_service_1.deleteAnnouncement)(id)];
                        case 1:
                            deleted = _a.sent();
                            if (!deleted) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'ANNOUNCEMENT_NOT_FOUND',
                                        message: 'Duyuru bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Duyuru silindi',
                                })];
                        case 2:
                            error_7 = _a.sent();
                            fastify.log.error('Delete announcement error:', error_7);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'DELETE_ANNOUNCEMENT_FAILED',
                                    message: error_7.message || 'Duyuru silinemedi',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/announcements/:id/activate
             * Activate an announcement (admin)
             */
            fastify.post('/:id/activate', { preHandler: auth_middleware_1.requireAdmin }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var id, announcement, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            id = request.params.id;
                            return [4 /*yield*/, (0, announcements_service_1.updateAnnouncement)(id, { status: 'active' })];
                        case 1:
                            announcement = _a.sent();
                            if (!announcement) {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'ANNOUNCEMENT_NOT_FOUND',
                                        message: 'Duyuru bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Duyuru aktifleştirildi',
                                    data: announcement,
                                })];
                        case 2:
                            error_8 = _a.sent();
                            fastify.log.error('Activate announcement error:', error_8);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'ACTIVATE_ANNOUNCEMENT_FAILED',
                                    message: error_8.message || 'Duyuru aktifleştirilemedi',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/announcements/:id/dismiss
             * Dismiss an announcement for the current user
             */
            fastify.post('/:id/dismiss', { preHandler: auth_middleware_1.requireAuth }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, id, dismissed, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            id = request.params.id;
                            return [4 /*yield*/, (0, announcements_service_1.dismissAnnouncement)(userId, id)];
                        case 1:
                            dismissed = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Duyuru kapatıldı',
                                    dismissed: dismissed,
                                })];
                        case 2:
                            error_9 = _a.sent();
                            fastify.log.error('Dismiss announcement error:', error_9);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'DISMISS_ANNOUNCEMENT_FAILED',
                                    message: error_9.message || 'Duyuru kapatılamadı',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

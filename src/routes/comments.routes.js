"use strict";
/**
 * Match Comments Routes - Match Forum/Discussion API Endpoints
 *
 * 12 endpoints for match comments system
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
exports.commentsRoutes = commentsRoutes;
var comments_service_1 = require("../services/comments.service");
var auth_middleware_1 = require("../middleware/auth.middleware");
// PR-10: Schema validation
var validation_middleware_1 = require("../middleware/validation.middleware");
var comments_schema_1 = require("../schemas/comments.schema");
function commentsRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            /**
             * POST /api/comments/match/:matchId
             * Create a comment on a match
             * Requires authentication
             * Body: { content }
             */
            // PR-10: Validate params and body
            fastify.post('/match/:matchId', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: comments_schema_1.matchIdParamSchema, body: comments_schema_1.createCommentSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, matchId, content, comment, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            matchId = parseInt(request.params.matchId);
                            content = request.body.content;
                            if (!content) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'content is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, comments_service_1.createComment)(userId, matchId, content)];
                        case 1:
                            comment = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Comment created successfully',
                                    data: comment,
                                })];
                        case 2:
                            error_1 = _a.sent();
                            fastify.log.error('Create comment error:', error_1);
                            if (error_1.message === 'Comment must be at least 3 characters' ||
                                error_1.message === 'Comment must be less than 1000 characters') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_CONTENT',
                                        message: error_1.message,
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'CREATE_COMMENT_FAILED',
                                    message: error_1.message || 'Failed to create comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/comments/:commentId/reply
             * Reply to a comment
             * Requires authentication
             * Body: { content }
             */
            // PR-10: Validate params and body
            fastify.post('/:commentId/reply', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema, body: comments_schema_1.replyCommentSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, commentId, content, replyComment, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            commentId = request.params.commentId;
                            content = request.body.content;
                            if (!content) {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'content is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, comments_service_1.replyToComment)(userId, commentId, content)];
                        case 1:
                            replyComment = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Reply created successfully',
                                    data: replyComment,
                                })];
                        case 2:
                            error_2 = _a.sent();
                            fastify.log.error('Reply comment error:', error_2);
                            if (error_2.message === 'Parent comment not found' ||
                                error_2.message === 'Cannot reply to hidden or deleted comment') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'PARENT_NOT_FOUND',
                                        message: error_2.message,
                                    })];
                            }
                            if (error_2.message === 'Reply must be at least 3 characters' ||
                                error_2.message === 'Reply must be less than 1000 characters') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_CONTENT',
                                        message: error_2.message,
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'REPLY_FAILED',
                                    message: error_2.message || 'Failed to create reply',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/comments/:commentId/like
             * Like a comment
             * Requires authentication
             */
            // PR-10: Validate params
            fastify.post('/:commentId/like', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, commentId, liked, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            commentId = request.params.commentId;
                            return [4 /*yield*/, (0, comments_service_1.likeComment)(userId, commentId)];
                        case 1:
                            liked = _a.sent();
                            if (!liked) {
                                return [2 /*return*/, reply.send({
                                        success: true,
                                        message: 'Already liked',
                                        alreadyLiked: true,
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Comment liked successfully',
                                })];
                        case 2:
                            error_3 = _a.sent();
                            fastify.log.error('Like comment error:', error_3);
                            if (error_3.message === 'Comment not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Yorum bulunamadı',
                                    })];
                            }
                            if (error_3.message === 'Cannot like your own comment') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'SELF_LIKE',
                                        message: 'Kendi yorumunu beğenemezsin',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'LIKE_FAILED',
                                    message: error_3.message || 'Failed to like comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * DELETE /api/comments/:commentId/like
             * Unlike a comment
             * Requires authentication
             */
            // PR-10: Validate params
            fastify.delete('/:commentId/like', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, commentId, unliked, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            commentId = request.params.commentId;
                            return [4 /*yield*/, (0, comments_service_1.unlikeComment)(userId, commentId)];
                        case 1:
                            unliked = _a.sent();
                            if (!unliked) {
                                return [2 /*return*/, reply.send({
                                        success: true,
                                        message: 'Like not found',
                                        notLiked: true,
                                    })];
                            }
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Comment unliked successfully',
                                })];
                        case 2:
                            error_4 = _a.sent();
                            fastify.log.error('Unlike comment error:', error_4);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'UNLIKE_FAILED',
                                    message: error_4.message || 'Failed to unlike comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/comments/:commentId/report
             * Report a comment (auto-hide at 3 reports)
             * Requires authentication
             */
            // PR-10: Validate params
            fastify.post('/:commentId/report', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var userId, commentId, result, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            userId = request.user.userId;
                            commentId = request.params.commentId;
                            return [4 /*yield*/, (0, comments_service_1.reportComment)(userId, commentId)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: result.autoHidden
                                        ? 'Yorum raporlandı ve gizlendi (3+ rapor)'
                                        : 'Yorum raporlandı',
                                    data: {
                                        reported: result.reported,
                                        autoHidden: result.autoHidden,
                                    },
                                })];
                        case 2:
                            error_5 = _a.sent();
                            fastify.log.error('Report comment error:', error_5);
                            if (error_5.message === 'Comment not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Yorum bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'REPORT_FAILED',
                                    message: error_5.message || 'Failed to report comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/comments/match/:matchId
             * Get match comments (top-level, paginated)
             * Query params: limit (default: 50), offset (default: 0)
             * Public endpoint (optionally authenticated for like status)
             */
            fastify.get('/match/:matchId', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, limit, offset, userId, comments, error_6;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            matchId = parseInt(request.params.matchId);
                            limit = Math.min(Number(request.query.limit) || 50, 100);
                            offset = Number(request.query.offset) || 0;
                            userId = ((_a = request.user) === null || _a === void 0 ? void 0 : _a.userId) || null;
                            return [4 /*yield*/, (0, comments_service_1.getMatchComments)(matchId, userId, limit, offset)];
                        case 1:
                            comments = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: comments,
                                    pagination: {
                                        limit: limit,
                                        offset: offset,
                                        count: comments.length,
                                    },
                                })];
                        case 2:
                            error_6 = _b.sent();
                            fastify.log.error('Get match comments error:', error_6);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_COMMENTS_FAILED',
                                    message: error_6.message || 'Failed to get match comments',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/comments/:commentId/replies
             * Get replies to a comment
             * Query params: limit (default: 20)
             * Public endpoint (optionally authenticated for like status)
             */
            fastify.get('/:commentId/replies', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, limit, userId, replies, error_7;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            limit = Math.min(Number(request.query.limit) || 20, 50);
                            userId = ((_a = request.user) === null || _a === void 0 ? void 0 : _a.userId) || null;
                            return [4 /*yield*/, (0, comments_service_1.getCommentReplies)(commentId, userId, limit)];
                        case 1:
                            replies = _b.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: replies,
                                })];
                        case 2:
                            error_7 = _b.sent();
                            fastify.log.error('Get comment replies error:', error_7);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_REPLIES_FAILED',
                                    message: error_7.message || 'Failed to get comment replies',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * GET /api/comments/match/:matchId/stats
             * Get match comment statistics
             * Public endpoint
             */
            fastify.get('/match/:matchId/stats', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, stats, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            matchId = parseInt(request.params.matchId);
                            return [4 /*yield*/, (0, comments_service_1.getMatchCommentStats)(matchId)];
                        case 1:
                            stats = _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    data: stats,
                                })];
                        case 2:
                            error_8 = _a.sent();
                            fastify.log.error('Get comment stats error:', error_8);
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'GET_STATS_FAILED',
                                    message: error_8.message || 'Failed to get comment statistics',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/comments/:commentId/hide
             * Hide comment (admin moderation)
             * Admin only
             */
            // PR-10: Validate params
            fastify.post('/:commentId/hide', { preHandler: [auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, error_9;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            return [4 /*yield*/, (0, comments_service_1.hideComment)(commentId)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Comment hidden successfully',
                                })];
                        case 2:
                            error_9 = _a.sent();
                            fastify.log.error('Hide comment error:', error_9);
                            if (error_9.message === 'Comment not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Yorum bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'HIDE_FAILED',
                                    message: error_9.message || 'Failed to hide comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/comments/:commentId/restore
             * Restore comment (admin moderation)
             * Admin only
             */
            // PR-10: Validate params
            fastify.post('/:commentId/restore', { preHandler: [auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, error_10;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            return [4 /*yield*/, (0, comments_service_1.restoreComment)(commentId)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Comment restored successfully',
                                })];
                        case 2:
                            error_10 = _a.sent();
                            fastify.log.error('Restore comment error:', error_10);
                            if (error_10.message === 'Comment not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Yorum bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'RESTORE_FAILED',
                                    message: error_10.message || 'Failed to restore comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * DELETE /api/comments/:commentId
             * Delete comment (admin moderation - soft delete)
             * Admin only
             */
            // PR-10: Validate params
            fastify.delete('/:commentId', { preHandler: [auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, error_11;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            return [4 /*yield*/, (0, comments_service_1.deleteComment)(commentId)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: 'Comment deleted successfully',
                                })];
                        case 2:
                            error_11 = _a.sent();
                            fastify.log.error('Delete comment error:', error_11);
                            if (error_11.message === 'Comment not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Yorum bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'DELETE_FAILED',
                                    message: error_11.message || 'Failed to delete comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/comments/:commentId/pin
             * Pin/unpin comment (admin)
             * Body: { isPinned }
             * Admin only
             */
            // PR-10: Validate params and body
            fastify.post('/:commentId/pin', { preHandler: [auth_middleware_1.requireAdmin, (0, validation_middleware_1.validate)({ params: comments_schema_1.commentIdParamSchema, body: comments_schema_1.togglePinSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, isPinned, error_12;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            isPinned = request.body.isPinned;
                            if (typeof isPinned !== 'boolean') {
                                return [2 /*return*/, reply.status(400).send({
                                        success: false,
                                        error: 'INVALID_REQUEST',
                                        message: 'isPinned (boolean) is required',
                                    })];
                            }
                            return [4 /*yield*/, (0, comments_service_1.togglePinComment)(commentId, isPinned)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, reply.send({
                                    success: true,
                                    message: isPinned
                                        ? 'Comment pinned successfully'
                                        : 'Comment unpinned successfully',
                                })];
                        case 2:
                            error_12 = _a.sent();
                            fastify.log.error('Toggle pin comment error:', error_12);
                            if (error_12.message === 'Comment not found') {
                                return [2 /*return*/, reply.status(404).send({
                                        success: false,
                                        error: 'NOT_FOUND',
                                        message: 'Yorum bulunamadı',
                                    })];
                            }
                            return [2 /*return*/, reply.status(500).send({
                                    success: false,
                                    error: 'PIN_FAILED',
                                    message: error_12.message || 'Failed to pin/unpin comment',
                                })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

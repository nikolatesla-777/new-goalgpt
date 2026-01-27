"use strict";
/**
 * Forum Routes
 *
 * API endpoints for Match Detail Forum tab:
 * - Comments (with likes, replies)
 * - Live Chat
 * - Polls
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
exports.default = forumRoutes;
var forumService_1 = require("../services/forum/forumService");
var auth_middleware_1 = require("../middleware/auth.middleware");
var logger_1 = require("../utils/logger");
// PR-10: Schema validation
var validation_middleware_1 = require("../middleware/validation.middleware");
var forum_schema_1 = require("../schemas/forum.schema");
function forumRoutes(fastify, options) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            // ============================================
            // COMMENTS ENDPOINTS
            // ============================================
            /**
             * GET /api/forum/:matchId/comments
             * Get comments for a match
             */
            fastify.get('/:matchId/comments', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, _a, limit, offset, userId, result, error_1;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            _a = request.query, limit = _a.limit, offset = _a.offset;
                            userId = (_b = request.user) === null || _b === void 0 ? void 0 : _b.id;
                            return [4 /*yield*/, forumService_1.commentsService.getComments(matchId, userId, parseInt(limit || '50'), parseInt(offset || '0'))];
                        case 1:
                            result = _c.sent();
                            reply.send({
                                success: true,
                                data: result,
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_1 = _c.sent();
                            logger_1.logger.error('[Forum] Error getting comments:', error_1);
                            reply.status(500).send({
                                success: false,
                                message: error_1.message || 'Failed to get comments',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/forum/:matchId/comments
             * Create a new comment (requires auth)
             */
            // PR-10: Validate params and body
            fastify.post('/:matchId/comments', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: forum_schema_1.forumMatchIdParamSchema, body: forum_schema_1.forumCommentSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, _a, content, parentId, userId, comment, error_2;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _c.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            _a = request.body, content = _a.content, parentId = _a.parentId;
                            userId = (_b = request.user) === null || _b === void 0 ? void 0 : _b.id;
                            if (!content || content.trim().length === 0) {
                                reply.status(400).send({
                                    success: false,
                                    message: 'Content is required',
                                });
                                return [2 /*return*/];
                            }
                            if (content.length > 1000) {
                                reply.status(400).send({
                                    success: false,
                                    message: 'Content too long (max 1000 characters)',
                                });
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, forumService_1.commentsService.createComment(matchId, userId, content.trim(), parentId)];
                        case 1:
                            comment = _c.sent();
                            reply.send({
                                success: true,
                                data: comment,
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_2 = _c.sent();
                            logger_1.logger.error('[Forum] Error creating comment:', error_2);
                            reply.status(500).send({
                                success: false,
                                message: error_2.message || 'Failed to create comment',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * DELETE /api/forum/comments/:commentId
             * Delete a comment (requires auth, owner only)
             */
            // PR-10: Validate params
            fastify.delete('/comments/:commentId', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: forum_schema_1.forumCommentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, userId, deleted, error_3;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            userId = (_a = request.user) === null || _a === void 0 ? void 0 : _a.id;
                            return [4 /*yield*/, forumService_1.commentsService.deleteComment(parseInt(commentId), userId)];
                        case 1:
                            deleted = _b.sent();
                            if (!deleted) {
                                reply.status(404).send({
                                    success: false,
                                    message: 'Comment not found or not authorized',
                                });
                                return [2 /*return*/];
                            }
                            reply.send({
                                success: true,
                                message: 'Comment deleted',
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_3 = _b.sent();
                            logger_1.logger.error('[Forum] Error deleting comment:', error_3);
                            reply.status(500).send({
                                success: false,
                                message: error_3.message || 'Failed to delete comment',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/forum/comments/:commentId/like
             * Like/unlike a comment (requires auth)
             */
            // PR-10: Validate params
            fastify.post('/comments/:commentId/like', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: forum_schema_1.forumCommentIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var commentId, userId, result, error_4;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            commentId = request.params.commentId;
                            userId = (_a = request.user) === null || _a === void 0 ? void 0 : _a.id;
                            return [4 /*yield*/, forumService_1.commentsService.toggleLike(parseInt(commentId), userId)];
                        case 1:
                            result = _b.sent();
                            reply.send({
                                success: true,
                                data: result,
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_4 = _b.sent();
                            logger_1.logger.error('[Forum] Error toggling like:', error_4);
                            reply.status(500).send({
                                success: false,
                                message: error_4.message || 'Failed to toggle like',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // ============================================
            // CHAT ENDPOINTS
            // ============================================
            /**
             * GET /api/forum/:matchId/chat
             * Get chat messages for a match
             */
            fastify.get('/:matchId/chat', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, _a, limit, before, messages, error_5;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            _a = request.query, limit = _a.limit, before = _a.before;
                            return [4 /*yield*/, forumService_1.chatService.getMessages(matchId, parseInt(limit || '100'), before ? parseInt(before) : undefined)];
                        case 1:
                            messages = _b.sent();
                            reply.send({
                                success: true,
                                data: {
                                    messages: messages,
                                    hasMore: messages.length === parseInt(limit || '100'),
                                },
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_5 = _b.sent();
                            logger_1.logger.error('[Forum] Error getting chat messages:', error_5);
                            reply.status(500).send({
                                success: false,
                                message: error_5.message || 'Failed to get chat messages',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/forum/:matchId/chat
             * Send a chat message (requires auth)
             */
            // PR-10: Validate params and body
            fastify.post('/:matchId/chat', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: forum_schema_1.forumMatchIdParamSchema, body: forum_schema_1.chatMessageSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, message, user, userId, username, chatMessage, error_6;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            message = request.body.message;
                            user = request.user;
                            userId = user === null || user === void 0 ? void 0 : user.id;
                            username = (user === null || user === void 0 ? void 0 : user.display_name) || ((_a = user === null || user === void 0 ? void 0 : user.email) === null || _a === void 0 ? void 0 : _a.split('@')[0]) || 'Anonim';
                            if (!message || message.trim().length === 0) {
                                reply.status(400).send({
                                    success: false,
                                    message: 'Message is required',
                                });
                                return [2 /*return*/];
                            }
                            if (message.length > 500) {
                                reply.status(400).send({
                                    success: false,
                                    message: 'Message too long (max 500 characters)',
                                });
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, forumService_1.chatService.sendMessage(matchId, userId, username, message.trim())];
                        case 1:
                            chatMessage = _b.sent();
                            reply.send({
                                success: true,
                                data: chatMessage,
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_6 = _b.sent();
                            logger_1.logger.error('[Forum] Error sending chat message:', error_6);
                            reply.status(500).send({
                                success: false,
                                message: error_6.message || 'Failed to send chat message',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * DELETE /api/forum/chat/:messageId
             * Delete a chat message (requires auth, owner only)
             */
            // PR-10: Validate params
            fastify.delete('/chat/:messageId', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: forum_schema_1.messageIdParamSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var messageId, userId, deleted, error_7;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            messageId = request.params.messageId;
                            userId = (_a = request.user) === null || _a === void 0 ? void 0 : _a.id;
                            return [4 /*yield*/, forumService_1.chatService.deleteMessage(parseInt(messageId), userId)];
                        case 1:
                            deleted = _b.sent();
                            if (!deleted) {
                                reply.status(404).send({
                                    success: false,
                                    message: 'Message not found or not authorized',
                                });
                                return [2 /*return*/];
                            }
                            reply.send({
                                success: true,
                                message: 'Message deleted',
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_7 = _b.sent();
                            logger_1.logger.error('[Forum] Error deleting chat message:', error_7);
                            reply.status(500).send({
                                success: false,
                                message: error_7.message || 'Failed to delete chat message',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            // ============================================
            // POLL ENDPOINTS
            // ============================================
            /**
             * GET /api/forum/:matchId/poll
             * Get or create poll for a match
             */
            fastify.get('/:matchId/poll', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, userId, poll, error_8;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            matchId = request.params.matchId;
                            userId = (_a = request.user) === null || _a === void 0 ? void 0 : _a.id;
                            return [4 /*yield*/, forumService_1.pollService.getOrCreatePoll(matchId, userId)];
                        case 1:
                            poll = _b.sent();
                            reply.send({
                                success: true,
                                data: poll,
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_8 = _b.sent();
                            logger_1.logger.error('[Forum] Error getting poll:', error_8);
                            reply.status(500).send({
                                success: false,
                                message: error_8.message || 'Failed to get poll',
                            });
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            /**
             * POST /api/forum/:matchId/poll/vote
             * Vote on a poll (requires auth)
             */
            // PR-10: Validate params and body
            fastify.post('/:matchId/poll/vote', { preHandler: [auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)({ params: forum_schema_1.forumMatchIdParamSchema, body: forum_schema_1.pollVoteSchema })] }, function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var matchId, vote, userId, poll, result, error_9;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, , 4]);
                            matchId = request.params.matchId;
                            vote = request.body.vote;
                            userId = (_a = request.user) === null || _a === void 0 ? void 0 : _a.id;
                            if (!['home', 'draw', 'away'].includes(vote)) {
                                reply.status(400).send({
                                    success: false,
                                    message: 'Invalid vote. Must be home, draw, or away',
                                });
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, forumService_1.pollService.getOrCreatePoll(matchId, userId)];
                        case 1:
                            poll = _b.sent();
                            if (!poll.is_active) {
                                reply.status(400).send({
                                    success: false,
                                    message: 'Poll is closed',
                                });
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, forumService_1.pollService.vote(poll.id, userId, vote)];
                        case 2:
                            result = _b.sent();
                            reply.send({
                                success: true,
                                data: result.poll,
                            });
                            return [3 /*break*/, 4];
                        case 3:
                            error_9 = _b.sent();
                            logger_1.logger.error('[Forum] Error voting on poll:', error_9);
                            reply.status(500).send({
                                success: false,
                                message: error_9.message || 'Failed to vote',
                            });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}

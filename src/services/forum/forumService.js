"use strict";
/**
 * Forum Service
 *
 * Handles match forum features:
 * - Comments (with likes, replies)
 * - Live Chat
 * - Polls (Kim kazanır?)
 *
 * Part of Match Detail page Forum tab.
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollService = exports.chatService = exports.commentsService = exports.PollService = exports.ChatService = exports.CommentsService = void 0;
var connection_1 = require("../../database/connection");
// ============================================
// COMMENTS SERVICE
// ============================================
var CommentsService = /** @class */ (function () {
    function CommentsService() {
    }
    /**
     * Get comments for a match (with nested replies)
     */
    CommentsService.prototype.getComments = function (matchId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function (matchId, userId, limit, offset) {
            var client, countResult, total, commentsResult, comments, commentIds, repliesResult, repliesMap, _i, _a, reply, parentId, _b, comments_1, comment, allIds, likesResult, likedIds, _c, comments_2, comment, _d, _e, reply;
            var _f;
            if (limit === void 0) { limit = 50; }
            if (offset === void 0) { offset = 0; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _g.sent();
                        _g.label = 2;
                    case 2:
                        _g.trys.push([2, , 9, 10]);
                        return [4 /*yield*/, client.query("\n        SELECT COUNT(*) as total\n        FROM ts_match_comments\n        WHERE match_id = $1 AND parent_id IS NULL AND is_deleted = false\n      ", [matchId])];
                    case 3:
                        countResult = _g.sent();
                        total = parseInt(((_f = countResult.rows[0]) === null || _f === void 0 ? void 0 : _f.total) || '0');
                        return [4 /*yield*/, client.query("\n        SELECT\n          c.*,\n          u.display_name as username,\n          u.avatar_url as user_avatar\n        FROM ts_match_comments c\n        LEFT JOIN users u ON c.user_id = u.id\n        WHERE c.match_id = $1 AND c.parent_id IS NULL AND c.is_deleted = false\n        ORDER BY c.created_at DESC\n        LIMIT $2 OFFSET $3\n      ", [matchId, limit, offset])];
                    case 4:
                        commentsResult = _g.sent();
                        comments = commentsResult.rows;
                        if (!(comments.length > 0)) return [3 /*break*/, 6];
                        commentIds = comments.map(function (c) { return c.id; });
                        return [4 /*yield*/, client.query("\n          SELECT\n            c.*,\n            u.display_name as username,\n            u.avatar_url as user_avatar\n          FROM ts_match_comments c\n          LEFT JOIN users u ON c.user_id = u.id\n          WHERE c.parent_id = ANY($1) AND c.is_deleted = false\n          ORDER BY c.created_at ASC\n        ", [commentIds])];
                    case 5:
                        repliesResult = _g.sent();
                        repliesMap = new Map();
                        for (_i = 0, _a = repliesResult.rows; _i < _a.length; _i++) {
                            reply = _a[_i];
                            parentId = reply.parent_id;
                            if (!repliesMap.has(parentId)) {
                                repliesMap.set(parentId, []);
                            }
                            repliesMap.get(parentId).push(reply);
                        }
                        // Attach replies to comments
                        for (_b = 0, comments_1 = comments; _b < comments_1.length; _b++) {
                            comment = comments_1[_b];
                            comment.replies = repliesMap.get(comment.id) || [];
                        }
                        _g.label = 6;
                    case 6:
                        if (!(userId && comments.length > 0)) return [3 /*break*/, 8];
                        allIds = __spreadArray(__spreadArray([], comments.map(function (c) { return c.id; }), true), comments.flatMap(function (c) { return (c.replies || []).map(function (r) { return r.id; }); }), true);
                        return [4 /*yield*/, client.query("\n          SELECT comment_id\n          FROM ts_match_comment_likes\n          WHERE comment_id = ANY($1) AND user_id = $2\n        ", [allIds, userId])];
                    case 7:
                        likesResult = _g.sent();
                        likedIds = new Set(likesResult.rows.map(function (r) { return r.comment_id; }));
                        for (_c = 0, comments_2 = comments; _c < comments_2.length; _c++) {
                            comment = comments_2[_c];
                            comment.is_liked_by_me = likedIds.has(comment.id);
                            for (_d = 0, _e = (comment.replies || []); _d < _e.length; _d++) {
                                reply = _e[_d];
                                reply.is_liked_by_me = likedIds.has(reply.id);
                            }
                        }
                        _g.label = 8;
                    case 8: return [2 /*return*/, { comments: comments, total: total }];
                    case 9:
                        client.release();
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new comment
     */
    CommentsService.prototype.createComment = function (matchId, userId, content, parentId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, comment, userResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 5, 6]);
                        return [4 /*yield*/, client.query("\n        INSERT INTO ts_match_comments (match_id, user_id, parent_id, content)\n        VALUES ($1, $2, $3, $4)\n        RETURNING *\n      ", [matchId, userId, parentId || null, content])];
                    case 3:
                        result = _a.sent();
                        comment = result.rows[0];
                        return [4 /*yield*/, client.query("\n        SELECT display_name as username, avatar_url as user_avatar\n        FROM users\n        WHERE id = $1\n      ", [userId])];
                    case 4:
                        userResult = _a.sent();
                        if (userResult.rows[0]) {
                            comment.username = userResult.rows[0].username;
                            comment.user_avatar = userResult.rows[0].user_avatar;
                        }
                        comment.replies = [];
                        comment.is_liked_by_me = false;
                        return [2 /*return*/, comment];
                    case 5:
                        client.release();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete a comment (soft delete)
     */
    CommentsService.prototype.deleteComment = function (commentId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.query("\n      UPDATE ts_match_comments\n      SET is_deleted = true, updated_at = NOW()\n      WHERE id = $1 AND user_id = $2\n      RETURNING id\n    ", [commentId, userId])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows.length > 0];
                }
            });
        });
    };
    /**
     * Like/unlike a comment
     */
    CommentsService.prototype.toggleLike = function (commentId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, existingLike, liked, countResult, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 13, 15, 16]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, client.query("\n        SELECT id FROM ts_match_comment_likes\n        WHERE comment_id = $1 AND user_id = $2\n      ", [commentId, userId])];
                    case 4:
                        existingLike = _b.sent();
                        liked = void 0;
                        if (!(existingLike.rows.length > 0)) return [3 /*break*/, 7];
                        // Unlike
                        return [4 /*yield*/, client.query("\n          DELETE FROM ts_match_comment_likes\n          WHERE comment_id = $1 AND user_id = $2\n        ", [commentId, userId])];
                    case 5:
                        // Unlike
                        _b.sent();
                        return [4 /*yield*/, client.query("\n          UPDATE ts_match_comments\n          SET likes_count = GREATEST(0, likes_count - 1)\n          WHERE id = $1\n        ", [commentId])];
                    case 6:
                        _b.sent();
                        liked = false;
                        return [3 /*break*/, 10];
                    case 7: 
                    // Like
                    return [4 /*yield*/, client.query("\n          INSERT INTO ts_match_comment_likes (comment_id, user_id)\n          VALUES ($1, $2)\n        ", [commentId, userId])];
                    case 8:
                        // Like
                        _b.sent();
                        return [4 /*yield*/, client.query("\n          UPDATE ts_match_comments\n          SET likes_count = likes_count + 1\n          WHERE id = $1\n        ", [commentId])];
                    case 9:
                        _b.sent();
                        liked = true;
                        _b.label = 10;
                    case 10: return [4 /*yield*/, client.query("\n        SELECT likes_count FROM ts_match_comments WHERE id = $1\n      ", [commentId])];
                    case 11:
                        countResult = _b.sent();
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 12:
                        _b.sent();
                        return [2 /*return*/, {
                                liked: liked,
                                likes_count: ((_a = countResult.rows[0]) === null || _a === void 0 ? void 0 : _a.likes_count) || 0
                            }];
                    case 13:
                        error_1 = _b.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 14:
                        _b.sent();
                        throw error_1;
                    case 15:
                        client.release();
                        return [7 /*endfinally*/];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    return CommentsService;
}());
exports.CommentsService = CommentsService;
// ============================================
// CHAT SERVICE
// ============================================
var ChatService = /** @class */ (function () {
    function ChatService() {
    }
    /**
     * Get recent chat messages for a match
     */
    ChatService.prototype.getMessages = function (matchId_1) {
        return __awaiter(this, arguments, void 0, function (matchId, limit, before) {
            var query, params, result;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n      SELECT *\n      FROM ts_match_chat\n      WHERE match_id = $1 AND is_deleted = false\n    ";
                        params = [matchId];
                        if (before) {
                            query += " AND id < $".concat(params.length + 1);
                            params.push(before);
                        }
                        query += " ORDER BY created_at DESC LIMIT $".concat(params.length + 1);
                        params.push(limit);
                        return [4 /*yield*/, connection_1.pool.query(query, params)];
                    case 1:
                        result = _a.sent();
                        // Reverse to get chronological order
                        return [2 /*return*/, result.rows.reverse()];
                }
            });
        });
    };
    /**
     * Send a chat message
     */
    ChatService.prototype.sendMessage = function (matchId, userId, username, message) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.query("\n      INSERT INTO ts_match_chat (match_id, user_id, username, message)\n      VALUES ($1, $2, $3, $4)\n      RETURNING *\n    ", [matchId, userId, username, message])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows[0]];
                }
            });
        });
    };
    /**
     * Delete a chat message (soft delete)
     */
    ChatService.prototype.deleteMessage = function (messageId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.query("\n      UPDATE ts_match_chat\n      SET is_deleted = true\n      WHERE id = $1 AND user_id = $2\n      RETURNING id\n    ", [messageId, userId])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows.length > 0];
                }
            });
        });
    };
    return ChatService;
}());
exports.ChatService = ChatService;
// ============================================
// POLL SERVICE
// ============================================
var PollService = /** @class */ (function () {
    function PollService() {
    }
    /**
     * Get or create poll for a match
     */
    PollService.prototype.getOrCreatePoll = function (matchId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, poll, voteResult;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, , 8, 9]);
                        return [4 /*yield*/, client.query("\n        SELECT * FROM ts_match_polls WHERE match_id = $1\n      ", [matchId])];
                    case 3:
                        result = _b.sent();
                        poll = void 0;
                        if (!(result.rows.length === 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, client.query("\n          INSERT INTO ts_match_polls (match_id, question)\n          VALUES ($1, 'Kim kazan\u0131r?')\n          RETURNING *\n        ", [matchId])];
                    case 4:
                        // Create new poll
                        result = _b.sent();
                        _b.label = 5;
                    case 5:
                        poll = result.rows[0];
                        poll.total_votes = poll.option_home_votes + poll.option_draw_votes + poll.option_away_votes;
                        if (!userId) return [3 /*break*/, 7];
                        return [4 /*yield*/, client.query("\n          SELECT vote FROM ts_match_poll_votes\n          WHERE poll_id = $1 AND user_id = $2\n        ", [poll.id, userId])];
                    case 6:
                        voteResult = _b.sent();
                        poll.my_vote = ((_a = voteResult.rows[0]) === null || _a === void 0 ? void 0 : _a.vote) || null;
                        _b.label = 7;
                    case 7: return [2 /*return*/, poll];
                    case 8:
                        client.release();
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Vote on a poll
     */
    PollService.prototype.vote = function (pollId, userId, vote) {
        return __awaiter(this, void 0, void 0, function () {
            var client, existingVote, previousVote, decrementColumn, incrementColumn, incrementColumn, pollResult, poll, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.connect()];
                    case 1:
                        client = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 13, 15, 16]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, client.query("\n        SELECT vote FROM ts_match_poll_votes\n        WHERE poll_id = $1 AND user_id = $2\n      ", [pollId, userId])];
                    case 4:
                        existingVote = _b.sent();
                        previousVote = (_a = existingVote.rows[0]) === null || _a === void 0 ? void 0 : _a.vote;
                        if (!previousVote) return [3 /*break*/, 7];
                        decrementColumn = "option_".concat(previousVote, "_votes");
                        incrementColumn = "option_".concat(vote, "_votes");
                        return [4 /*yield*/, client.query("\n          UPDATE ts_match_polls\n          SET ".concat(decrementColumn, " = GREATEST(0, ").concat(decrementColumn, " - 1),\n              ").concat(incrementColumn, " = ").concat(incrementColumn, " + 1\n          WHERE id = $1\n        "), [pollId])];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, client.query("\n          UPDATE ts_match_poll_votes\n          SET vote = $1\n          WHERE poll_id = $2 AND user_id = $3\n        ", [vote, pollId, userId])];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 7:
                        incrementColumn = "option_".concat(vote, "_votes");
                        return [4 /*yield*/, client.query("\n          UPDATE ts_match_polls\n          SET ".concat(incrementColumn, " = ").concat(incrementColumn, " + 1\n          WHERE id = $1\n        "), [pollId])];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, client.query("\n          INSERT INTO ts_match_poll_votes (poll_id, user_id, vote)\n          VALUES ($1, $2, $3)\n        ", [pollId, userId, vote])];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10: return [4 /*yield*/, client.query("\n        SELECT * FROM ts_match_polls WHERE id = $1\n      ", [pollId])];
                    case 11:
                        pollResult = _b.sent();
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 12:
                        _b.sent();
                        poll = pollResult.rows[0];
                        poll.total_votes = poll.option_home_votes + poll.option_draw_votes + poll.option_away_votes;
                        poll.my_vote = vote;
                        return [2 /*return*/, { success: true, poll: poll }];
                    case 13:
                        error_2 = _b.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 14:
                        _b.sent();
                        throw error_2;
                    case 15:
                        client.release();
                        return [7 /*endfinally*/];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Close a poll (when match ends)
     */
    PollService.prototype.closePoll = function (matchId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, connection_1.pool.query("\n      UPDATE ts_match_polls\n      SET is_active = false, closed_at = NOW()\n      WHERE match_id = $1 AND is_active = true\n      RETURNING id\n    ", [matchId])];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows.length > 0];
                }
            });
        });
    };
    return PollService;
}());
exports.PollService = PollService;
// ============================================
// SINGLETON EXPORTS
// ============================================
exports.commentsService = new CommentsService();
exports.chatService = new ChatService();
exports.pollService = new PollService();

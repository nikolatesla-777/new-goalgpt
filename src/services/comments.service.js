"use strict";
/**
 * Match Comments Service - Match Forum/Discussion Management
 *
 * Features:
 * - Match comments with threading (reply support)
 * - Like/unlike comments
 * - Report system (auto-hide at 3 reports)
 * - XP rewards for commenting
 * - Admin moderation (hide/delete/restore)
 */
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.createComment = createComment;
exports.replyToComment = replyToComment;
exports.likeComment = likeComment;
exports.unlikeComment = unlikeComment;
exports.reportComment = reportComment;
exports.getMatchComments = getMatchComments;
exports.getCommentReplies = getCommentReplies;
exports.hideComment = hideComment;
exports.deleteComment = deleteComment;
exports.restoreComment = restoreComment;
exports.togglePinComment = togglePinComment;
exports.getMatchCommentStats = getMatchCommentStats;
var kysely_1 = require("../database/kysely");
var kysely_2 = require("kysely");
var xp_service_1 = require("./xp.service");
/**
 * Create a comment on a match
 */
function createComment(userId, matchId, content) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var comment, checkAndUnlockBadges, commentCount;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                // Validate content
                                if (!content || content.trim().length < 3) {
                                    throw new Error('Comment must be at least 3 characters');
                                }
                                if (content.length > 1000) {
                                    throw new Error('Comment must be less than 1000 characters');
                                }
                                return [4 /*yield*/, trx
                                        .insertInto('match_comments')
                                        .values({
                                        match_id: matchId,
                                        customer_user_id: userId,
                                        parent_comment_id: null,
                                        content: content.trim(),
                                        like_count: 0,
                                        is_pinned: false,
                                        is_reported: false,
                                        report_count: 0,
                                        status: 'active',
                                        created_at: (0, kysely_2.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        updated_at: (0, kysely_2.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        deleted_at: null,
                                    })
                                        .returning(['id', 'match_id', 'customer_user_id', 'content', 'created_at'])
                                        .executeTakeFirstOrThrow()];
                            case 1:
                                comment = _a.sent();
                                // Grant XP reward for commenting
                                return [4 /*yield*/, (0, xp_service_1.grantXP)({
                                        userId: userId,
                                        amount: 5, // 5 XP per comment
                                        transactionType: xp_service_1.XPTransactionType.MATCH_COMMENT,
                                        description: "Ma\u00E7 yorumu yapt\u0131n",
                                        referenceId: comment.id,
                                        referenceType: 'comment',
                                    })];
                            case 2:
                                // Grant XP reward for commenting
                                _a.sent();
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./badges.service')); })];
                            case 3:
                                checkAndUnlockBadges = (_a.sent()).checkAndUnlockBadges;
                                return [4 /*yield*/, trx
                                        .selectFrom('match_comments')
                                        .select((0, kysely_2.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('count'))
                                        .where('customer_user_id', '=', userId)
                                        .where('deleted_at', 'is', null)
                                        .executeTakeFirst()];
                            case 4:
                                commentCount = _a.sent();
                                return [4 /*yield*/, checkAndUnlockBadges(userId, 'comments', Number((commentCount === null || commentCount === void 0 ? void 0 : commentCount.count) || 0))];
                            case 5:
                                _a.sent();
                                return [2 /*return*/, comment];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Reply to a comment
 */
function replyToComment(userId, parentCommentId, content) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var parentComment, reply;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                // Validate content
                                if (!content || content.trim().length < 3) {
                                    throw new Error('Reply must be at least 3 characters');
                                }
                                if (content.length > 1000) {
                                    throw new Error('Reply must be less than 1000 characters');
                                }
                                return [4 /*yield*/, trx
                                        .selectFrom('match_comments')
                                        .select(['match_id', 'status'])
                                        .where('id', '=', parentCommentId)
                                        .where('deleted_at', 'is', null)
                                        .executeTakeFirst()];
                            case 1:
                                parentComment = _a.sent();
                                if (!parentComment) {
                                    throw new Error('Parent comment not found');
                                }
                                if (parentComment.status !== 'active') {
                                    throw new Error('Cannot reply to hidden or deleted comment');
                                }
                                return [4 /*yield*/, trx
                                        .insertInto('match_comments')
                                        .values({
                                        match_id: parentComment.match_id,
                                        customer_user_id: userId,
                                        parent_comment_id: parentCommentId,
                                        content: content.trim(),
                                        like_count: 0,
                                        is_pinned: false,
                                        is_reported: false,
                                        report_count: 0,
                                        status: 'active',
                                        created_at: (0, kysely_2.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        updated_at: (0, kysely_2.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                        deleted_at: null,
                                    })
                                        .returning(['id', 'match_id', 'parent_comment_id', 'content', 'created_at'])
                                        .executeTakeFirstOrThrow()];
                            case 2:
                                reply = _a.sent();
                                // Grant XP reward
                                return [4 /*yield*/, (0, xp_service_1.grantXP)({
                                        userId: userId,
                                        amount: 5,
                                        transactionType: xp_service_1.XPTransactionType.MATCH_COMMENT,
                                        description: "Yoruma cevap verdin",
                                        referenceId: reply.id,
                                        referenceType: 'comment',
                                    })];
                            case 3:
                                // Grant XP reward
                                _a.sent();
                                return [2 /*return*/, reply];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Like a comment
 */
function likeComment(userId, commentId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var existingLike, comment;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .selectFrom('match_comment_likes')
                                    .select('id')
                                    .where('comment_id', '=', commentId)
                                    .where('customer_user_id', '=', userId)
                                    .executeTakeFirst()];
                            case 1:
                                existingLike = _a.sent();
                                if (existingLike) {
                                    return [2 /*return*/, false]; // Already liked
                                }
                                return [4 /*yield*/, trx
                                        .selectFrom('match_comments')
                                        .select('customer_user_id')
                                        .where('id', '=', commentId)
                                        .where('deleted_at', 'is', null)
                                        .where('status', '=', 'active')
                                        .executeTakeFirst()];
                            case 2:
                                comment = _a.sent();
                                if (!comment) {
                                    throw new Error('Comment not found');
                                }
                                // Prevent self-liking
                                if (comment.customer_user_id === userId) {
                                    throw new Error('Cannot like your own comment');
                                }
                                // Create like
                                return [4 /*yield*/, trx
                                        .insertInto('match_comment_likes')
                                        .values({
                                        comment_id: commentId,
                                        customer_user_id: userId,
                                        created_at: (0, kysely_2.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .execute()];
                            case 3:
                                // Create like
                                _a.sent();
                                // Increment like count
                                return [4 /*yield*/, trx
                                        .updateTable('match_comments')
                                        .set({
                                        like_count: (0, kysely_2.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["like_count + 1"], ["like_count + 1"]))),
                                        updated_at: (0, kysely_2.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('id', '=', commentId)
                                        .execute()];
                            case 4:
                                // Increment like count
                                _a.sent();
                                // Grant 2 XP to comment owner
                                return [4 /*yield*/, (0, xp_service_1.grantXP)({
                                        userId: comment.customer_user_id,
                                        amount: 2,
                                        transactionType: xp_service_1.XPTransactionType.COMMENT_LIKE,
                                        description: "Yorumun be\u011Fenildi",
                                        referenceId: commentId,
                                        referenceType: 'comment',
                                    })];
                            case 5:
                                // Grant 2 XP to comment owner
                                _a.sent();
                                return [2 /*return*/, true];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Unlike a comment
 */
function unlikeComment(userId, commentId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .deleteFrom('match_comment_likes')
                                    .where('comment_id', '=', commentId)
                                    .where('customer_user_id', '=', userId)
                                    .executeTakeFirst()];
                            case 1:
                                result = _a.sent();
                                if (result.numDeletedRows === 0n) {
                                    return [2 /*return*/, false]; // Like not found
                                }
                                // Decrement like count
                                return [4 /*yield*/, trx
                                        .updateTable('match_comments')
                                        .set({
                                        like_count: (0, kysely_2.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["GREATEST(like_count - 1, 0)"], ["GREATEST(like_count - 1, 0)"]))),
                                        updated_at: (0, kysely_2.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('id', '=', commentId)
                                        .execute()];
                            case 2:
                                // Decrement like count
                                _a.sent();
                                return [2 /*return*/, true];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Report a comment (auto-hide at 3 reports)
 */
function reportComment(userId, commentId) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, kysely_1.db.transaction().execute(function (trx) { return __awaiter(_this, void 0, void 0, function () {
                    var updatedComment, reportCount, autoHidden;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, trx
                                    .updateTable('match_comments')
                                    .set({
                                    report_count: (0, kysely_2.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["report_count + 1"], ["report_count + 1"]))),
                                    is_reported: true,
                                    updated_at: (0, kysely_2.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                })
                                    .where('id', '=', commentId)
                                    .where('deleted_at', 'is', null)
                                    .returning(['report_count'])
                                    .executeTakeFirst()];
                            case 1:
                                updatedComment = _a.sent();
                                if (!updatedComment) {
                                    throw new Error('Comment not found');
                                }
                                reportCount = updatedComment.report_count;
                                autoHidden = false;
                                if (!(reportCount >= 3)) return [3 /*break*/, 3];
                                return [4 /*yield*/, trx
                                        .updateTable('match_comments')
                                        .set({
                                        status: 'flagged',
                                        updated_at: (0, kysely_2.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                                    })
                                        .where('id', '=', commentId)
                                        .execute()];
                            case 2:
                                _a.sent();
                                autoHidden = true;
                                _a.label = 3;
                            case 3: return [2 /*return*/, { reported: true, autoHidden: autoHidden }];
                        }
                    });
                }); })];
        });
    });
}
/**
 * Get match comments (paginated, with threading)
 */
function getMatchComments(matchId_1, currentUserId_1) {
    return __awaiter(this, arguments, void 0, function (matchId, currentUserId, limit, offset) {
        var comments;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('match_comments as mc')
                        .innerJoin('customer_users as cu', 'cu.id', 'mc.customer_user_id')
                        .leftJoin('match_comment_likes as mcl', function (join) {
                        return join
                            .onRef('mcl.comment_id', '=', 'mc.id')
                            .on('mcl.customer_user_id', '=', currentUserId || '');
                    })
                        .select([
                        'mc.id',
                        'mc.match_id',
                        'mc.customer_user_id',
                        'mc.parent_comment_id',
                        'mc.content',
                        'mc.like_count',
                        'mc.is_pinned',
                        'mc.is_reported',
                        'mc.report_count',
                        'mc.status',
                        'mc.created_at',
                        'mc.updated_at',
                        'cu.full_name as user_name',
                        'cu.username as user_username',
                        (0, kysely_2.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END"], ["CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END"]))).as('user_liked'),
                        (0, kysely_2.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["(SELECT COUNT(*) FROM match_comments WHERE parent_comment_id = mc.id AND deleted_at IS NULL)"], ["(SELECT COUNT(*) FROM match_comments WHERE parent_comment_id = mc.id AND deleted_at IS NULL)"]))).as('reply_count'),
                    ])
                        .where('mc.match_id', '=', matchId)
                        .where('mc.parent_comment_id', 'is', null)
                        .where('mc.deleted_at', 'is', null)
                        .where('mc.status', 'in', ['active', 'flagged'])
                        .orderBy('mc.is_pinned', 'desc')
                        .orderBy('mc.created_at', 'desc')
                        .limit(limit)
                        .offset(offset)
                        .execute()];
                case 1:
                    comments = _a.sent();
                    return [2 /*return*/, comments];
            }
        });
    });
}
/**
 * Get replies to a comment
 */
function getCommentReplies(commentId_1, currentUserId_1) {
    return __awaiter(this, arguments, void 0, function (commentId, currentUserId, limit) {
        var replies;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('match_comments as mc')
                        .innerJoin('customer_users as cu', 'cu.id', 'mc.customer_user_id')
                        .leftJoin('match_comment_likes as mcl', function (join) {
                        return join
                            .onRef('mcl.comment_id', '=', 'mc.id')
                            .on('mcl.customer_user_id', '=', currentUserId || '');
                    })
                        .select([
                        'mc.id',
                        'mc.match_id',
                        'mc.customer_user_id',
                        'mc.parent_comment_id',
                        'mc.content',
                        'mc.like_count',
                        'mc.is_pinned',
                        'mc.is_reported',
                        'mc.report_count',
                        'mc.status',
                        'mc.created_at',
                        'mc.updated_at',
                        'cu.full_name as user_name',
                        'cu.username as user_username',
                        (0, kysely_2.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END"], ["CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END"]))).as('user_liked'),
                        (0, kysely_2.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["0"], ["0"]))).as('reply_count'),
                    ])
                        .where('mc.parent_comment_id', '=', commentId)
                        .where('mc.deleted_at', 'is', null)
                        .where('mc.status', 'in', ['active', 'flagged'])
                        .orderBy('mc.created_at', 'asc')
                        .limit(limit)
                        .execute()];
                case 1:
                    replies = _a.sent();
                    return [2 /*return*/, replies];
            }
        });
    });
}
/**
 * Hide comment (admin moderation)
 */
function hideComment(commentId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('match_comments')
                        .set({
                        status: 'hidden',
                        updated_at: (0, kysely_2.sql)(templateObject_18 || (templateObject_18 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', commentId)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Comment not found');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Delete comment (admin moderation - soft delete)
 */
function deleteComment(commentId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('match_comments')
                        .set({
                        status: 'deleted',
                        deleted_at: (0, kysely_2.sql)(templateObject_19 || (templateObject_19 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                        updated_at: (0, kysely_2.sql)(templateObject_20 || (templateObject_20 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', commentId)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Comment not found');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Restore comment (admin moderation)
 */
function restoreComment(commentId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('match_comments')
                        .set({
                        status: 'active',
                        is_reported: false,
                        report_count: 0,
                        updated_at: (0, kysely_2.sql)(templateObject_21 || (templateObject_21 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', commentId)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Comment not found');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Pin/unpin comment (admin)
 */
function togglePinComment(commentId, isPinned) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .updateTable('match_comments')
                        .set({
                        is_pinned: isPinned,
                        updated_at: (0, kysely_2.sql)(templateObject_22 || (templateObject_22 = __makeTemplateObject(["NOW()"], ["NOW()"]))),
                    })
                        .where('id', '=', commentId)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    result = _a.sent();
                    if (result.numUpdatedRows === 0n) {
                        throw new Error('Comment not found');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Get comment statistics for a match
 */
function getMatchCommentStats(matchId) {
    return __awaiter(this, void 0, void 0, function () {
        var stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kysely_1.db
                        .selectFrom('match_comments')
                        .select([
                        (0, kysely_2.sql)(templateObject_23 || (templateObject_23 = __makeTemplateObject(["COUNT(*)"], ["COUNT(*)"]))).as('total_comments'),
                        (0, kysely_2.sql)(templateObject_24 || (templateObject_24 = __makeTemplateObject(["COUNT(*) FILTER (WHERE parent_comment_id IS NULL)"], ["COUNT(*) FILTER (WHERE parent_comment_id IS NULL)"]))).as('top_level_comments'),
                        (0, kysely_2.sql)(templateObject_25 || (templateObject_25 = __makeTemplateObject(["COUNT(*) FILTER (WHERE parent_comment_id IS NOT NULL)"], ["COUNT(*) FILTER (WHERE parent_comment_id IS NOT NULL)"]))).as('replies'),
                        (0, kysely_2.sql)(templateObject_26 || (templateObject_26 = __makeTemplateObject(["COUNT(*) FILTER (WHERE status = 'flagged')"], ["COUNT(*) FILTER (WHERE status = 'flagged')"]))).as('flagged_comments'),
                        (0, kysely_2.sql)(templateObject_27 || (templateObject_27 = __makeTemplateObject(["SUM(like_count)"], ["SUM(like_count)"]))).as('total_likes'),
                    ])
                        .where('match_id', '=', matchId)
                        .where('deleted_at', 'is', null)
                        .executeTakeFirst()];
                case 1:
                    stats = _a.sent();
                    return [2 /*return*/, {
                            totalComments: Number((stats === null || stats === void 0 ? void 0 : stats.total_comments) || 0),
                            topLevelComments: Number((stats === null || stats === void 0 ? void 0 : stats.top_level_comments) || 0),
                            replies: Number((stats === null || stats === void 0 ? void 0 : stats.replies) || 0),
                            flaggedComments: Number((stats === null || stats === void 0 ? void 0 : stats.flagged_comments) || 0),
                            totalLikes: Number((stats === null || stats === void 0 ? void 0 : stats.total_likes) || 0),
                        }];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27;

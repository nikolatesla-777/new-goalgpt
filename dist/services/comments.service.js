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
const kysely_1 = require("../database/kysely");
const kysely_2 = require("kysely");
const xp_service_1 = require("./xp.service");
/**
 * Create a comment on a match
 */
async function createComment(userId, matchId, content) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // Validate content
        if (!content || content.trim().length < 3) {
            throw new Error('Comment must be at least 3 characters');
        }
        if (content.length > 1000) {
            throw new Error('Comment must be less than 1000 characters');
        }
        // Create comment
        const comment = await trx
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
            created_at: (0, kysely_2.sql) `NOW()`,
            updated_at: (0, kysely_2.sql) `NOW()`,
            deleted_at: null,
        })
            .returning(['id', 'match_id', 'customer_user_id', 'content', 'created_at'])
            .executeTakeFirstOrThrow();
        // Grant XP reward for commenting
        await (0, xp_service_1.grantXP)({
            userId,
            amount: 5, // 5 XP per comment
            transactionType: 'match_comment',
            description: `Maç yorumu yaptın`,
            referenceId: comment.id,
            referenceType: 'comment',
        });
        // Check and unlock comment badges
        const { checkAndUnlockBadges } = await Promise.resolve().then(() => __importStar(require('./badges.service')));
        const commentCount = await trx
            .selectFrom('match_comments')
            .select((0, kysely_2.sql) `COUNT(*)`.as('count'))
            .where('customer_user_id', '=', userId)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
        await checkAndUnlockBadges(userId, 'comments', Number(commentCount?.count || 0));
        return comment;
    });
}
/**
 * Reply to a comment
 */
async function replyToComment(userId, parentCommentId, content) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // Validate content
        if (!content || content.trim().length < 3) {
            throw new Error('Reply must be at least 3 characters');
        }
        if (content.length > 1000) {
            throw new Error('Reply must be less than 1000 characters');
        }
        // Get parent comment
        const parentComment = await trx
            .selectFrom('match_comments')
            .select(['match_id', 'status'])
            .where('id', '=', parentCommentId)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
        if (!parentComment) {
            throw new Error('Parent comment not found');
        }
        if (parentComment.status !== 'active') {
            throw new Error('Cannot reply to hidden or deleted comment');
        }
        // Create reply
        const reply = await trx
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
            created_at: (0, kysely_2.sql) `NOW()`,
            updated_at: (0, kysely_2.sql) `NOW()`,
            deleted_at: null,
        })
            .returning(['id', 'match_id', 'parent_comment_id', 'content', 'created_at'])
            .executeTakeFirstOrThrow();
        // Grant XP reward
        await (0, xp_service_1.grantXP)({
            userId,
            amount: 5,
            transactionType: 'match_comment',
            description: `Yoruma cevap verdin`,
            referenceId: reply.id,
            referenceType: 'comment',
        });
        return reply;
    });
}
/**
 * Like a comment
 */
async function likeComment(userId, commentId) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // Check if already liked
        const existingLike = await trx
            .selectFrom('match_comment_likes')
            .select('id')
            .where('comment_id', '=', commentId)
            .where('customer_user_id', '=', userId)
            .executeTakeFirst();
        if (existingLike) {
            return false; // Already liked
        }
        // Get comment owner
        const comment = await trx
            .selectFrom('match_comments')
            .select('customer_user_id')
            .where('id', '=', commentId)
            .where('deleted_at', 'is', null)
            .where('status', '=', 'active')
            .executeTakeFirst();
        if (!comment) {
            throw new Error('Comment not found');
        }
        // Prevent self-liking
        if (comment.customer_user_id === userId) {
            throw new Error('Cannot like your own comment');
        }
        // Create like
        await trx
            .insertInto('match_comment_likes')
            .values({
            comment_id: commentId,
            customer_user_id: userId,
            created_at: (0, kysely_2.sql) `NOW()`,
        })
            .execute();
        // Increment like count
        await trx
            .updateTable('match_comments')
            .set({
            like_count: (0, kysely_2.sql) `like_count + 1`,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .where('id', '=', commentId)
            .execute();
        // Grant 2 XP to comment owner
        await (0, xp_service_1.grantXP)({
            userId: comment.customer_user_id,
            amount: 2,
            transactionType: 'comment_like',
            description: `Yorumun beğenildi`,
            referenceId: commentId,
            referenceType: 'comment',
        });
        return true;
    });
}
/**
 * Unlike a comment
 */
async function unlikeComment(userId, commentId) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // Delete like
        const result = await trx
            .deleteFrom('match_comment_likes')
            .where('comment_id', '=', commentId)
            .where('customer_user_id', '=', userId)
            .executeTakeFirst();
        if (result.numDeletedRows === 0n) {
            return false; // Like not found
        }
        // Decrement like count
        await trx
            .updateTable('match_comments')
            .set({
            like_count: (0, kysely_2.sql) `GREATEST(like_count - 1, 0)`,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .where('id', '=', commentId)
            .execute();
        return true;
    });
}
/**
 * Report a comment (auto-hide at 3 reports)
 */
async function reportComment(userId, commentId) {
    return kysely_1.db.transaction().execute(async (trx) => {
        // Check if user already reported
        // (We can track this by checking if user reported before - for now, allow multiple reports)
        // Increment report count
        const updatedComment = await trx
            .updateTable('match_comments')
            .set({
            report_count: (0, kysely_2.sql) `report_count + 1`,
            is_reported: true,
            updated_at: (0, kysely_2.sql) `NOW()`,
        })
            .where('id', '=', commentId)
            .where('deleted_at', 'is', null)
            .returning(['report_count'])
            .executeTakeFirst();
        if (!updatedComment) {
            throw new Error('Comment not found');
        }
        const reportCount = updatedComment.report_count;
        // Auto-hide if 3+ reports
        let autoHidden = false;
        if (reportCount >= 3) {
            await trx
                .updateTable('match_comments')
                .set({
                status: 'flagged',
                updated_at: (0, kysely_2.sql) `NOW()`,
            })
                .where('id', '=', commentId)
                .execute();
            autoHidden = true;
        }
        return { reported: true, autoHidden };
    });
}
/**
 * Get match comments (paginated, with threading)
 */
async function getMatchComments(matchId, currentUserId, limit = 50, offset = 0) {
    // Get top-level comments (no parent)
    const comments = await kysely_1.db
        .selectFrom('match_comments as mc')
        .innerJoin('customer_users as cu', 'cu.id', 'mc.customer_user_id')
        .leftJoin('match_comment_likes as mcl', (join) => join
        .onRef('mcl.comment_id', '=', 'mc.id')
        .on('mcl.customer_user_id', '=', currentUserId || ''))
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
        (0, kysely_2.sql) `CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END`.as('user_liked'),
        (0, kysely_2.sql) `(SELECT COUNT(*) FROM match_comments WHERE parent_comment_id = mc.id AND deleted_at IS NULL)`.as('reply_count'),
    ])
        .where('mc.match_id', '=', matchId)
        .where('mc.parent_comment_id', 'is', null)
        .where('mc.deleted_at', 'is', null)
        .where('mc.status', 'in', ['active', 'flagged'])
        .orderBy('mc.is_pinned', 'desc')
        .orderBy('mc.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();
    return comments;
}
/**
 * Get replies to a comment
 */
async function getCommentReplies(commentId, currentUserId, limit = 20) {
    const replies = await kysely_1.db
        .selectFrom('match_comments as mc')
        .innerJoin('customer_users as cu', 'cu.id', 'mc.customer_user_id')
        .leftJoin('match_comment_likes as mcl', (join) => join
        .onRef('mcl.comment_id', '=', 'mc.id')
        .on('mcl.customer_user_id', '=', currentUserId || ''))
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
        (0, kysely_2.sql) `CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END`.as('user_liked'),
        (0, kysely_2.sql) `0`.as('reply_count'),
    ])
        .where('mc.parent_comment_id', '=', commentId)
        .where('mc.deleted_at', 'is', null)
        .where('mc.status', 'in', ['active', 'flagged'])
        .orderBy('mc.created_at', 'asc')
        .limit(limit)
        .execute();
    return replies;
}
/**
 * Hide comment (admin moderation)
 */
async function hideComment(commentId) {
    const result = await kysely_1.db
        .updateTable('match_comments')
        .set({
        status: 'hidden',
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', commentId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Comment not found');
    }
}
/**
 * Delete comment (admin moderation - soft delete)
 */
async function deleteComment(commentId) {
    const result = await kysely_1.db
        .updateTable('match_comments')
        .set({
        status: 'deleted',
        deleted_at: (0, kysely_2.sql) `NOW()`,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', commentId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Comment not found');
    }
}
/**
 * Restore comment (admin moderation)
 */
async function restoreComment(commentId) {
    const result = await kysely_1.db
        .updateTable('match_comments')
        .set({
        status: 'active',
        is_reported: false,
        report_count: 0,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', commentId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Comment not found');
    }
}
/**
 * Pin/unpin comment (admin)
 */
async function togglePinComment(commentId, isPinned) {
    const result = await kysely_1.db
        .updateTable('match_comments')
        .set({
        is_pinned: isPinned,
        updated_at: (0, kysely_2.sql) `NOW()`,
    })
        .where('id', '=', commentId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
        throw new Error('Comment not found');
    }
}
/**
 * Get comment statistics for a match
 */
async function getMatchCommentStats(matchId) {
    const stats = await kysely_1.db
        .selectFrom('match_comments')
        .select([
        (0, kysely_2.sql) `COUNT(*)`.as('total_comments'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE parent_comment_id IS NULL)`.as('top_level_comments'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE parent_comment_id IS NOT NULL)`.as('replies'),
        (0, kysely_2.sql) `COUNT(*) FILTER (WHERE status = 'flagged')`.as('flagged_comments'),
        (0, kysely_2.sql) `SUM(like_count)`.as('total_likes'),
    ])
        .where('match_id', '=', matchId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
    return {
        totalComments: Number(stats?.total_comments || 0),
        topLevelComments: Number(stats?.top_level_comments || 0),
        replies: Number(stats?.replies || 0),
        flaggedComments: Number(stats?.flagged_comments || 0),
        totalLikes: Number(stats?.total_likes || 0),
    };
}

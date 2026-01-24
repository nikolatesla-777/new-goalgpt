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

import { db } from '../database/kysely';
import { sql } from 'kysely';
import { grantXP, XPTransactionType } from './xp.service';

// Comment status types
export type CommentStatus = 'active' | 'hidden' | 'deleted' | 'flagged';

// Comment interface
export interface MatchComment {
  id: string;
  match_id: number;
  customer_user_id: string;
  parent_comment_id: string | null;
  content: string;
  like_count: number;
  is_pinned: boolean;
  is_reported: boolean;
  report_count: number;
  status: CommentStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// Comment with user details
export interface CommentWithUser extends MatchComment {
  user_name: string;
  user_username: string | null;
  user_liked: boolean; // If current user liked this comment
  reply_count: number;
}

/**
 * Create a comment on a match
 */
export async function createComment(
  userId: string,
  matchId: number,
  content: string
): Promise<MatchComment> {
  return db.transaction().execute(async (trx) => {
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
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
        deleted_at: null,
      })
      .returning(['id', 'match_id', 'customer_user_id', 'content', 'created_at'])
      .executeTakeFirstOrThrow();

    // Grant XP reward for commenting
    await grantXP({
      userId,
      amount: 5, // 5 XP per comment
      transactionType: XPTransactionType.MATCH_COMMENT,
      description: `Maç yorumu yaptın`,
      referenceId: comment.id,
      referenceType: 'comment',
    });

    // Check and unlock comment badges
    const { checkAndUnlockBadges } = await import('./badges.service');
    const commentCount = await trx
      .selectFrom('match_comments')
      .select(sql<number>`COUNT(*)`.as('count'))
      .where('customer_user_id', '=', userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    await checkAndUnlockBadges(userId, 'comments', Number(commentCount?.count || 0));

    return comment as any;
  });
}

/**
 * Reply to a comment
 */
export async function replyToComment(
  userId: string,
  parentCommentId: string,
  content: string
): Promise<MatchComment> {
  return db.transaction().execute(async (trx) => {
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
        created_at: sql`NOW()`,
        updated_at: sql`NOW()`,
        deleted_at: null,
      })
      .returning(['id', 'match_id', 'parent_comment_id', 'content', 'created_at'])
      .executeTakeFirstOrThrow();

    // Grant XP reward
    await grantXP({
      userId,
      amount: 5,
      transactionType: XPTransactionType.MATCH_COMMENT,
      description: `Yoruma cevap verdin`,
      referenceId: reply.id,
      referenceType: 'comment',
    });

    return reply as any;
  });
}

/**
 * Like a comment
 */
export async function likeComment(userId: string, commentId: string): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
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
        created_at: sql`NOW()`,
      })
      .execute();

    // Increment like count
    await trx
      .updateTable('match_comments')
      .set({
        like_count: sql`like_count + 1`,
        updated_at: sql`NOW()`,
      })
      .where('id', '=', commentId)
      .execute();

    // Grant 2 XP to comment owner
    await grantXP({
      userId: comment.customer_user_id,
      amount: 2,
      transactionType: XPTransactionType.COMMENT_LIKE,
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
export async function unlikeComment(userId: string, commentId: string): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
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
        like_count: sql`GREATEST(like_count - 1, 0)`,
        updated_at: sql`NOW()`,
      })
      .where('id', '=', commentId)
      .execute();

    return true;
  });
}

/**
 * Report a comment (auto-hide at 3 reports)
 */
export async function reportComment(userId: string, commentId: string): Promise<{
  reported: boolean;
  autoHidden: boolean;
}> {
  return db.transaction().execute(async (trx) => {
    // Check if user already reported
    // (We can track this by checking if user reported before - for now, allow multiple reports)

    // Increment report count
    const updatedComment = await trx
      .updateTable('match_comments')
      .set({
        report_count: sql`report_count + 1`,
        is_reported: true,
        updated_at: sql`NOW()`,
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
          updated_at: sql`NOW()`,
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
export async function getMatchComments(
  matchId: number,
  currentUserId: string | null,
  limit: number = 50,
  offset: number = 0
): Promise<CommentWithUser[]> {
  // Get top-level comments (no parent)
  const comments = await db
    .selectFrom('match_comments as mc')
    .innerJoin('customer_users as cu', 'cu.id', 'mc.customer_user_id')
    .leftJoin('match_comment_likes as mcl', (join) =>
      join
        .onRef('mcl.comment_id', '=', 'mc.id')
        .on('mcl.customer_user_id', '=', currentUserId || '')
    )
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
      sql<boolean>`CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END`.as('user_liked'),
      sql<number>`(SELECT COUNT(*) FROM match_comments WHERE parent_comment_id = mc.id AND deleted_at IS NULL)`.as(
        'reply_count'
      ),
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

  return comments as any[];
}

/**
 * Get replies to a comment
 */
export async function getCommentReplies(
  commentId: string,
  currentUserId: string | null,
  limit: number = 20
): Promise<CommentWithUser[]> {
  const replies = await db
    .selectFrom('match_comments as mc')
    .innerJoin('customer_users as cu', 'cu.id', 'mc.customer_user_id')
    .leftJoin('match_comment_likes as mcl', (join) =>
      join
        .onRef('mcl.comment_id', '=', 'mc.id')
        .on('mcl.customer_user_id', '=', currentUserId || '')
    )
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
      sql<boolean>`CASE WHEN mcl.id IS NOT NULL THEN true ELSE false END`.as('user_liked'),
      sql<number>`0`.as('reply_count'),
    ])
    .where('mc.parent_comment_id', '=', commentId)
    .where('mc.deleted_at', 'is', null)
    .where('mc.status', 'in', ['active', 'flagged'])
    .orderBy('mc.created_at', 'asc')
    .limit(limit)
    .execute();

  return replies as any[];
}

/**
 * Hide comment (admin moderation)
 */
export async function hideComment(commentId: string): Promise<void> {
  const result = await db
    .updateTable('match_comments')
    .set({
      status: 'hidden',
      updated_at: sql`NOW()`,
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
export async function deleteComment(commentId: string): Promise<void> {
  const result = await db
    .updateTable('match_comments')
    .set({
      status: 'deleted',
      deleted_at: sql`NOW()`,
      updated_at: sql`NOW()`,
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
export async function restoreComment(commentId: string): Promise<void> {
  const result = await db
    .updateTable('match_comments')
    .set({
      status: 'active',
      is_reported: false,
      report_count: 0,
      updated_at: sql`NOW()`,
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
export async function togglePinComment(commentId: string, isPinned: boolean): Promise<void> {
  const result = await db
    .updateTable('match_comments')
    .set({
      is_pinned: isPinned,
      updated_at: sql`NOW()`,
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
export async function getMatchCommentStats(matchId: number) {
  const stats = await db
    .selectFrom('match_comments')
    .select([
      sql<number>`COUNT(*)`.as('total_comments'),
      sql<number>`COUNT(*) FILTER (WHERE parent_comment_id IS NULL)`.as('top_level_comments'),
      sql<number>`COUNT(*) FILTER (WHERE parent_comment_id IS NOT NULL)`.as('replies'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'flagged')`.as('flagged_comments'),
      sql<number>`SUM(like_count)`.as('total_likes'),
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

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

import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';

// ============================================
// TYPES
// ============================================

export interface Comment {
  id: number;
  match_id: string;
  user_id: string;
  parent_id: number | null;
  content: string;
  likes_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Enriched fields
  username?: string;
  user_avatar?: string;
  is_liked_by_me?: boolean;
  replies?: Comment[];
}

export interface ChatMessage {
  id: number;
  match_id: string;
  user_id: string;
  username: string;
  message: string;
  is_deleted: boolean;
  created_at: string;
}

export interface Poll {
  id: number;
  match_id: string;
  question: string;
  option_home_votes: number;
  option_draw_votes: number;
  option_away_votes: number;
  is_active: boolean;
  created_at: string;
  closed_at: string | null;
  // Calculated
  total_votes: number;
  my_vote?: 'home' | 'draw' | 'away' | null;
}

export interface PollVoteResult {
  success: boolean;
  poll: Poll;
}

// ============================================
// COMMENTS SERVICE
// ============================================

export class CommentsService {
  /**
   * Get comments for a match (with nested replies)
   */
  async getComments(matchId: string, userId?: string, limit = 50, offset = 0): Promise<{
    comments: Comment[];
    total: number;
  }> {
    const client = await pool.connect();
    try {
      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total
        FROM ts_match_comments
        WHERE match_id = $1 AND parent_id IS NULL AND is_deleted = false
      `, [matchId]);
      const total = parseInt(countResult.rows[0]?.total || '0');

      // Get top-level comments with user info
      const commentsResult = await client.query(`
        SELECT
          c.*,
          u.display_name as username,
          u.avatar_url as user_avatar
        FROM ts_match_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.match_id = $1 AND c.parent_id IS NULL AND c.is_deleted = false
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
      `, [matchId, limit, offset]);

      const comments = commentsResult.rows;

      // Get replies for each comment
      if (comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        const repliesResult = await client.query(`
          SELECT
            c.*,
            u.display_name as username,
            u.avatar_url as user_avatar
          FROM ts_match_comments c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.parent_id = ANY($1) AND c.is_deleted = false
          ORDER BY c.created_at ASC
        `, [commentIds]);

        // Group replies by parent
        const repliesMap = new Map<number, Comment[]>();
        for (const reply of repliesResult.rows) {
          const parentId = reply.parent_id;
          if (!repliesMap.has(parentId)) {
            repliesMap.set(parentId, []);
          }
          repliesMap.get(parentId)!.push(reply);
        }

        // Attach replies to comments
        for (const comment of comments) {
          comment.replies = repliesMap.get(comment.id) || [];
        }
      }

      // Check likes if user is provided
      if (userId && comments.length > 0) {
        const allIds = [
          ...comments.map(c => c.id),
          ...comments.flatMap(c => (c.replies || []).map((r: Comment) => r.id))
        ];

        const likesResult = await client.query(`
          SELECT comment_id
          FROM ts_match_comment_likes
          WHERE comment_id = ANY($1) AND user_id = $2
        `, [allIds, userId]);

        const likedIds = new Set(likesResult.rows.map(r => r.comment_id));

        for (const comment of comments) {
          comment.is_liked_by_me = likedIds.has(comment.id);
          for (const reply of (comment.replies || [])) {
            reply.is_liked_by_me = likedIds.has(reply.id);
          }
        }
      }

      return { comments, total };
    } finally {
      client.release();
    }
  }

  /**
   * Create a new comment
   */
  async createComment(matchId: string, userId: string, content: string, parentId?: number): Promise<Comment> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO ts_match_comments (match_id, user_id, parent_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [matchId, userId, parentId || null, content]);

      const comment = result.rows[0];

      // Get user info
      const userResult = await client.query(`
        SELECT display_name as username, avatar_url as user_avatar
        FROM users
        WHERE id = $1
      `, [userId]);

      if (userResult.rows[0]) {
        comment.username = userResult.rows[0].username;
        comment.user_avatar = userResult.rows[0].user_avatar;
      }

      comment.replies = [];
      comment.is_liked_by_me = false;

      return comment;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(commentId: number, userId: string): Promise<boolean> {
    const result = await pool.query(`
      UPDATE ts_match_comments
      SET is_deleted = true, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [commentId, userId]);

    return result.rows.length > 0;
  }

  /**
   * Like/unlike a comment
   */
  async toggleLike(commentId: number, userId: string): Promise<{ liked: boolean; likes_count: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if already liked
      const existingLike = await client.query(`
        SELECT id FROM ts_match_comment_likes
        WHERE comment_id = $1 AND user_id = $2
      `, [commentId, userId]);

      let liked: boolean;
      if (existingLike.rows.length > 0) {
        // Unlike
        await client.query(`
          DELETE FROM ts_match_comment_likes
          WHERE comment_id = $1 AND user_id = $2
        `, [commentId, userId]);

        await client.query(`
          UPDATE ts_match_comments
          SET likes_count = GREATEST(0, likes_count - 1)
          WHERE id = $1
        `, [commentId]);

        liked = false;
      } else {
        // Like
        await client.query(`
          INSERT INTO ts_match_comment_likes (comment_id, user_id)
          VALUES ($1, $2)
        `, [commentId, userId]);

        await client.query(`
          UPDATE ts_match_comments
          SET likes_count = likes_count + 1
          WHERE id = $1
        `, [commentId]);

        liked = true;
      }

      // Get updated count
      const countResult = await client.query(`
        SELECT likes_count FROM ts_match_comments WHERE id = $1
      `, [commentId]);

      await client.query('COMMIT');

      return {
        liked,
        likes_count: countResult.rows[0]?.likes_count || 0
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// ============================================
// CHAT SERVICE
// ============================================

export class ChatService {
  /**
   * Get recent chat messages for a match
   */
  async getMessages(matchId: string, limit = 100, before?: number): Promise<ChatMessage[]> {
    let query = `
      SELECT *
      FROM ts_match_chat
      WHERE match_id = $1 AND is_deleted = false
    `;
    const params: any[] = [matchId];

    if (before) {
      query += ` AND id < $${params.length + 1}`;
      params.push(before);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Reverse to get chronological order
    return result.rows.reverse();
  }

  /**
   * Send a chat message
   */
  async sendMessage(matchId: string, userId: string, username: string, message: string): Promise<ChatMessage> {
    const result = await pool.query(`
      INSERT INTO ts_match_chat (match_id, user_id, username, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [matchId, userId, username, message]);

    return result.rows[0];
  }

  /**
   * Delete a chat message (soft delete)
   */
  async deleteMessage(messageId: number, userId: string): Promise<boolean> {
    const result = await pool.query(`
      UPDATE ts_match_chat
      SET is_deleted = true
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [messageId, userId]);

    return result.rows.length > 0;
  }
}

// ============================================
// POLL SERVICE
// ============================================

export class PollService {
  /**
   * Get or create poll for a match
   */
  async getOrCreatePoll(matchId: string, userId?: string): Promise<Poll> {
    const client = await pool.connect();
    try {
      // Try to get existing poll
      let result = await client.query(`
        SELECT * FROM ts_match_polls WHERE match_id = $1
      `, [matchId]);

      let poll: Poll;

      if (result.rows.length === 0) {
        // Create new poll
        result = await client.query(`
          INSERT INTO ts_match_polls (match_id, question)
          VALUES ($1, 'Kim kazanır?')
          RETURNING *
        `, [matchId]);
      }

      poll = result.rows[0];
      poll.total_votes = poll.option_home_votes + poll.option_draw_votes + poll.option_away_votes;

      // Check user's vote if userId provided
      if (userId) {
        const voteResult = await client.query(`
          SELECT vote FROM ts_match_poll_votes
          WHERE poll_id = $1 AND user_id = $2
        `, [poll.id, userId]);

        poll.my_vote = voteResult.rows[0]?.vote || null;
      }

      return poll;
    } finally {
      client.release();
    }
  }

  /**
   * Vote on a poll
   */
  async vote(pollId: number, userId: string, vote: 'home' | 'draw' | 'away'): Promise<PollVoteResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if already voted
      const existingVote = await client.query(`
        SELECT vote FROM ts_match_poll_votes
        WHERE poll_id = $1 AND user_id = $2
      `, [pollId, userId]);

      const previousVote = existingVote.rows[0]?.vote;

      if (previousVote) {
        // Change vote - decrement previous, increment new
        const decrementColumn = `option_${previousVote}_votes`;
        const incrementColumn = `option_${vote}_votes`;

        await client.query(`
          UPDATE ts_match_polls
          SET ${decrementColumn} = GREATEST(0, ${decrementColumn} - 1),
              ${incrementColumn} = ${incrementColumn} + 1
          WHERE id = $1
        `, [pollId]);

        await client.query(`
          UPDATE ts_match_poll_votes
          SET vote = $1
          WHERE poll_id = $2 AND user_id = $3
        `, [vote, pollId, userId]);
      } else {
        // New vote
        const incrementColumn = `option_${vote}_votes`;

        await client.query(`
          UPDATE ts_match_polls
          SET ${incrementColumn} = ${incrementColumn} + 1
          WHERE id = $1
        `, [pollId]);

        await client.query(`
          INSERT INTO ts_match_poll_votes (poll_id, user_id, vote)
          VALUES ($1, $2, $3)
        `, [pollId, userId, vote]);
      }

      // Get updated poll
      const pollResult = await client.query(`
        SELECT * FROM ts_match_polls WHERE id = $1
      `, [pollId]);

      await client.query('COMMIT');

      const poll = pollResult.rows[0];
      poll.total_votes = poll.option_home_votes + poll.option_draw_votes + poll.option_away_votes;
      poll.my_vote = vote;

      return { success: true, poll };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close a poll (when match ends)
   */
  async closePoll(matchId: string): Promise<boolean> {
    const result = await pool.query(`
      UPDATE ts_match_polls
      SET is_active = false, closed_at = NOW()
      WHERE match_id = $1 AND is_active = true
      RETURNING id
    `, [matchId]);

    return result.rows.length > 0;
  }
}

// ============================================
// SINGLETON EXPORTS
// ============================================

export const commentsService = new CommentsService();
export const chatService = new ChatService();
export const pollService = new PollService();

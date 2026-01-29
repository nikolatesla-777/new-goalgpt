/**
 * Phase-3A: Scoring Preview Routes
 *
 * API endpoints for admin panel scoring preview
 *
 * IMPORTANT: This is a simplified version for Phase-3A MVP.
 * When Week-2A scoring pipeline is merged, these endpoints
 * should be replaced/enhanced with the full scoring system.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMatchScoringPreview } from '../services/admin/scoringPreview.service';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/matches/:fsMatchId/scoring-preview
 *
 * Returns simplified scoring preview for a match (Phase-3A MVP)
 */
export async function scoringRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/matches/:fsMatchId/scoring-preview',
    async (
      request: FastifyRequest<{
        Params: { fsMatchId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const fsMatchId = parseInt(request.params.fsMatchId, 10);

        if (isNaN(fsMatchId)) {
          return reply.status(400).send({
            error: 'Invalid fs_match_id',
          });
        }

        logger.info(`[Scoring Preview] GET /matches/${fsMatchId}/scoring-preview`);

        const preview = await getMatchScoringPreview(fsMatchId);

        return reply.status(200).send({
          success: true,
          data: preview,
        });
      } catch (error: any) {
        logger.error('[Scoring Preview] Error:', error);

        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'Match not found',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Failed to generate scoring preview',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/admin/publish-with-audit
   *
   * Publish match to Telegram with full audit logging
   * Supports DRY_RUN mode for testing
   */
  fastify.post(
    '/admin/publish-with-audit',
    async (
      request: FastifyRequest<{
        Body: {
          match_id: string;
          fs_match_id: number;
          market_id: string;
          channel_id: string;
          payload: any;
          dry_run?: boolean;
          admin_user_id?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const {
        match_id,
        fs_match_id,
        market_id,
        channel_id,
        payload,
        dry_run = false,
        admin_user_id = 'admin-panel',
      } = request.body;

      const requestId = uuidv4();

      logger.info(`[Admin Publish] request_id=${requestId} dry_run=${dry_run} market=${market_id}`);

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Insert audit log
        const logResult = await client.query(
          `INSERT INTO admin_publish_logs (
            request_id,
            admin_user_id,
            match_id,
            fs_match_id,
            market_id,
            channel_id,
            payload,
            dry_run,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id`,
          [
            requestId,
            admin_user_id,
            match_id,
            fs_match_id,
            market_id,
            channel_id,
            JSON.stringify(payload),
            dry_run,
            'pending',
          ]
        );

        const logId = logResult.rows[0].id;

        if (dry_run) {
          // DRY_RUN mode: No actual send, just validate
          logger.info(`[Admin Publish] DRY_RUN mode - would publish to channel=${channel_id}`);

          await client.query(
            `UPDATE admin_publish_logs
             SET status = 'dry_run_success', completed_at = NOW()
             WHERE id = $1`,
            [logId]
          );

          await client.query('COMMIT');

          return reply.status(200).send({
            success: true,
            dry_run: true,
            request_id: requestId,
            message: 'DRY_RUN: Would publish successfully',
            log_id: logId,
          });
        }

        // TODO: Actual Telegram publish logic here
        // For Phase-3A MVP, we'll mark as 'sent' but not actually send
        // This will be replaced when integrating with existing TelegramBot service

        logger.warn('[Admin Publish] PHASE-3A: Actual Telegram send not implemented yet');

        await client.query(
          `UPDATE admin_publish_logs
           SET status = 'sent', telegram_message_id = $2, completed_at = NOW()
           WHERE id = $1`,
          [logId, 'mock-telegram-id']
        );

        await client.query('COMMIT');

        return reply.status(200).send({
          success: true,
          request_id: requestId,
          message: 'Published successfully (mock)',
          log_id: logId,
          telegram_message_id: 'mock-telegram-id',
        });
      } catch (error: any) {
        await client.query('ROLLBACK');

        logger.error(`[Admin Publish] Error: ${error.message}`);

        // Try to update log with error
        try {
          await client.query(
            `UPDATE admin_publish_logs
             SET status = 'failed', error_message = $2, completed_at = NOW()
             WHERE request_id = $1`,
            [requestId, error.message]
          );
        } catch (logError) {
          logger.error('[Admin Publish] Failed to update error log:', logError);
        }

        return reply.status(500).send({
          error: 'Failed to publish',
          message: error.message,
          request_id: requestId,
        });
      } finally {
        client.release();
      }
    }
  );

  /**
   * GET /api/admin/publish-logs
   *
   * Get recent publish logs for admin panel
   */
  fastify.get(
    '/admin/publish-logs',
    async (
      request: FastifyRequest<{
        Querystring: {
          limit?: string;
          match_id?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const limit = parseInt(request.query.limit || '50', 10);
        const { match_id } = request.query;

        let query = `
          SELECT
            id,
            request_id,
            admin_user_id,
            match_id,
            fs_match_id,
            market_id,
            channel_id,
            payload,
            dry_run,
            status,
            telegram_message_id,
            error_message,
            created_at,
            completed_at
          FROM admin_publish_logs
        `;

        const params: any[] = [];
        if (match_id) {
          query += ' WHERE match_id = $1';
          params.push(match_id);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await pool.query(query, params);

        return reply.status(200).send({
          success: true,
          count: result.rows.length,
          logs: result.rows,
        });
      } catch (error: any) {
        logger.error('[Admin Logs] Error:', error);
        return reply.status(500).send({
          error: 'Failed to fetch logs',
          message: error.message,
        });
      }
    }
  );
}

/**
 * Phase-3A.1: Scoring Routes (DEPRECATED - Proxy to Week-2A)
 *
 * MIGRATION NOTE:
 * - scoring-preview endpoint is DEPRECATED and proxies to Week-2A's GET /api/matches/:id/scoring
 * - Admin endpoints moved to admin.routes.ts with ADMIN_API_KEY protection
 *
 * This file will be removed entirely once Week-2A is merged and frontend is updated.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

/**
 * GET /api/matches/:fsMatchId/scoring-preview
 *
 * DEPRECATED: This endpoint proxies to Week-2A's GET /api/matches/:id/scoring
 *
 * Once Week-2A is merged, frontend should use /api/matches/:id/scoring directly.
 * This proxy exists only for Phase-3A compatibility during transition.
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

        logger.warn(
          `[Scoring Preview] DEPRECATED endpoint called: /matches/${fsMatchId}/scoring-preview`
        );

        // Check if Week-2A scoring endpoint is available
        // Try to proxy to GET /api/matches/:id/scoring
        try {
          const response = await fastify.inject({
            method: 'GET',
            url: `/api/matches/${fsMatchId}/scoring?locale=tr`,
          });

          if (response.statusCode === 200) {
            const week2AData = JSON.parse(response.body);

            logger.info(
              `[Scoring Preview] Successfully proxied to Week-2A endpoint for match ${fsMatchId}`
            );

            // Return in Phase-3A format for compatibility
            return reply.status(200).send({
              success: true,
              data: week2AData,
              _note: 'Data from Week-2A scoring pipeline. Update frontend to use /api/matches/:id/scoring directly.',
            });
          }

          // Week-2A endpoint returned error
          logger.warn(
            `[Scoring Preview] Week-2A endpoint returned ${response.statusCode} for match ${fsMatchId}`
          );

          throw new Error(
            `Week-2A scoring endpoint returned ${response.statusCode}`
          );
        } catch (proxyError: any) {
          // Week-2A not available yet
          logger.error(
            `[Scoring Preview] Week-2A endpoint not available: ${proxyError.message}`
          );

          return reply.status(503).send({
            error: 'Week-2A scoring pipeline not available',
            message:
              'The deterministic scoring system (Week-2A) has not been merged yet. This endpoint will become available after Week-2A deployment.',
            week_2a_status: 'NOT_MERGED',
            fallback_note:
              'Phase-3A admin panel requires Week-2A scoring system to function.',
          });
        }
      } catch (error: any) {
        logger.error('[Scoring Preview] Error:', error);

        return reply.status(500).send({
          error: 'Failed to generate scoring preview',
          message: error.message,
        });
      }
    }
  );
}

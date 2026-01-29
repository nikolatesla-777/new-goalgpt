/**
 * Admin Routes - Phase-3B
 *
 * Admin-only endpoints with ADMIN_API_KEY authentication
 * Includes:
 * - POST /api/admin/ai-summary - Generate AI match summary
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import {
  generateAISummary,
  generateSummaryFromMatchId,
} from '../services/admin/aiSummaryFormatter.service';
import type { AISummaryRequest } from '../types/aiSummary.types';

/**
 * ADMIN_API_KEY authentication middleware
 */
async function requireAdminApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-admin-api-key'] as string | undefined;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    logger.error('[AdminRoutes] ADMIN_API_KEY not configured in environment');
    return reply.status(500).send({
      error: 'Server configuration error',
      message: 'ADMIN_API_KEY not configured',
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    logger.warn('[AdminRoutes] Unauthorized access attempt', {
      ip: request.ip,
      path: request.url,
    });
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid ADMIN_API_KEY. Please provide a valid x-admin-api-key header.',
    });
  }
}

/**
 * Admin routes registration
 */
export default async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply ADMIN_API_KEY auth to all routes
  fastify.addHook('preHandler', requireAdminApiKey);

  /**
   * POST /api/admin/ai-summary
   *
   * Generate AI match summary
   *
   * Request body:
   * {
   *   "match_id": "12345",
   *   "locale": "tr" | "en"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "match_id": "12345",
   *     "title": "Barcelona vs Real Madrid - La Liga Analysis",
   *     "key_angles": [...],
   *     "bet_ideas": [...],
   *     "disclaimer": "...",
   *     "generated_at": "2026-01-29T...",
   *     "locale": "tr"
   *   }
   * }
   */
  fastify.post<{
    Body: AISummaryRequest;
  }>('/ai-summary', async (request, reply) => {
    const { match_id, locale = 'tr' } = request.body;

    // Validation
    if (!match_id || typeof match_id !== 'string') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'match_id is required and must be a string',
      });
    }

    if (locale && !['tr', 'en'].includes(locale)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'locale must be "tr" or "en"',
      });
    }

    logger.info(`[AdminRoutes] Generating AI summary for match ${match_id} (locale: ${locale})`);

    try {
      // Generate summary
      const result = await generateSummaryFromMatchId(match_id, locale);

      if (!result.success) {
        logger.warn(`[AdminRoutes] AI summary generation failed: ${result.error}`);
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: result.error || 'Failed to generate summary',
          note: 'Week-2A endpoint may not be available yet',
        });
      }

      // Update match_id in response
      if (result.data) {
        result.data.match_id = match_id;
      }

      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[AdminRoutes] Error in /ai-summary:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Unknown error',
      });
    }
  });

  logger.info('✅ Admin routes registered');
}

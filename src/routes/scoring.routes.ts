/**
 * Scoring Routes - Consolidated (Week-2A + Phase-3A.1 Deprecation)
 *
 * Week-2A: GET /matches/:id/scoring - Full scoring pipeline (PRIMARY)
 * Phase-3A.1: GET /matches/:fsMatchId/scoring-preview - DEPRECATED proxy endpoint
 *
 * MIGRATION NOTE:
 * - scoring-preview is DEPRECATED and proxies to Week-2A endpoint
 * - Frontend should migrate to /api/matches/:id/scoring directly
 *
 * @author GoalGPT Team
 * @version 2.1.0 (Phase-3A.1 alignment)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { featureBuilderService } from '../services/scoring/featureBuilder.service';
import { marketScorerService, type MarketId, type ScoringResult } from '../services/scoring/marketScorer.service';
import { publishEligibilityUtils } from '../services/scoring/publishEligibility';
import { logger } from '../utils/logger';

/**
 * Valid market IDs
 */
const VALID_MARKETS: MarketId[] = [
  'O25',
  'BTTS',
  'HT_O05',
  'O35',
  'HOME_O15',
  'CORNERS_O85',
  'CARDS_O25',
];

/**
 * Query parameters for /matches/:id/scoring
 */
interface ScoringQuery {
  markets?: string; // Comma-separated market IDs (e.g., "O25,BTTS")
  locale?: string;  // Locale for display names (tr|en, default: en)
}

/**
 * Route parameters
 */
interface MatchParams {
  id: string; // TheSports external match ID
}

/**
 * Scoring result with publish eligibility
 */
interface ScoringResultWithEligibility extends ScoringResult {
  can_publish: boolean;
  publish_reason: string;
  failed_checks?: string[];
  passed_checks?: string[];
}

/**
 * Scoring API response
 */
interface ScoringResponse {
  match_id: string;
  source_refs: {
    thesports_match_id: string;
    thesports_internal_id?: string;
    footystats_match_id?: number;
    footystats_linked: boolean;
    link_method?: string;
  };
  features: any; // ScoringFeatures (full object)
  risk_flags: string[];
  results: ScoringResultWithEligibility[];
  generated_at: number;
}

/**
 * Register scoring routes
 */
export async function registerScoringRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // WEEK-2A: Full Scoring Pipeline (PRIMARY ENDPOINT)
  // ============================================================================

  /**
   * GET /api/matches/:id/scoring
   *
   * Get scoring results for a specific match
   *
   * Query params:
   * - markets (optional): Comma-separated market IDs (e.g., "O25,BTTS")
   *   If not provided, returns all 7 markets
   * - locale (optional): Display locale (tr|en, default: en)
   *
   * Response:
   * {
   *   match_id: string,
   *   source_refs: { ... },
   *   features: ScoringFeatures,
   *   risk_flags: string[],
   *   results: ScoringResult[],
   *   generated_at: number
   * }
   *
   * Status codes:
   * - 200: Success
   * - 400: Invalid market ID or bad request
   * - 404: Match not found
   * - 503: FootyStats data unavailable (degraded mode)
   */
  fastify.get<{
    Params: MatchParams;
    Querystring: ScoringQuery;
  }>(
    '/api/matches/:id/scoring',
    async (request, reply) => {
      const matchId = request.params.id;
      const marketsParam = request.query.markets;
      const locale = (request.query.locale || 'en') as 'tr' | 'en';

      logger.info(`[Scoring] GET /matches/${matchId}/scoring`, {
        markets: marketsParam,
        locale,
      });

      try {
        // Parse requested markets
        let requestedMarkets: MarketId[] = VALID_MARKETS;
        if (marketsParam) {
          const parsed = marketsParam
            .split(',')
            .map((m) => m.trim())
            .filter((m) => VALID_MARKETS.includes(m as MarketId)) as MarketId[];

          if (parsed.length === 0) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `Invalid market IDs. Valid markets: ${VALID_MARKETS.join(', ')}`,
            });
          }

          requestedMarkets = parsed;
        }

        // Build features
        const featureResult = await featureBuilderService.buildFeatures(matchId);

        if (!featureResult.success) {
          if (featureResult.error_code === 'MATCH_NOT_FOUND') {
            return reply.status(404).send({
              error: 'Not Found',
              message: featureResult.error || 'Match not found',
            });
          }

          return reply.status(503).send({
            error: 'Service Unavailable',
            message: featureResult.error || 'Failed to fetch match data',
            error_code: featureResult.error_code,
          });
        }

        // Score markets
        const scoringResults: ScoringResultWithEligibility[] = [];
        for (const marketId of requestedMarkets) {
          const result = await marketScorerService.scoreMarket(
            marketId,
            featureResult.features!,
            locale
          );

          // Check publish eligibility
          const eligibility = publishEligibilityUtils.checkEligibility(
            result,
            featureResult.features!
          );

          scoringResults.push({
            ...result,
            can_publish: eligibility.can_publish,
            publish_reason: eligibility.reason,
            failed_checks: eligibility.failed_checks,
            passed_checks: eligibility.passed_checks,
          });
        }

        // Response
        const response: ScoringResponse = {
          match_id: matchId,
          source_refs: {
            thesports_match_id: matchId,
            thesports_internal_id: featureResult.features!.match.ts_internal_id,
            footystats_match_id: featureResult.features!.footystats?.match?.id,
            footystats_linked: featureResult.features!.footystats?.linked || false,
            link_method: featureResult.features!.footystats?.link_method,
          },
          features: featureResult.features,
          risk_flags: featureResult.features!.risk_flags || [],
          results: scoringResults,
          generated_at: Date.now(),
        };

        return reply.status(200).send(response);
      } catch (error: any) {
        logger.error('[Scoring] Unexpected error:', error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Unexpected error during scoring',
        });
      }
    }
  );

  // ============================================================================
  // PHASE-3A.1: DEPRECATED Proxy Endpoint (Backward Compatibility)
  // ============================================================================

  /**
   * GET /api/matches/:fsMatchId/scoring-preview
   *
   * DEPRECATED: This endpoint proxies to Week-2A's GET /api/matches/:id/scoring
   *
   * Once Week-2A is merged, frontend should use /api/matches/:id/scoring directly.
   * This proxy exists only for Phase-3A compatibility during transition.
   */
  fastify.get(
    '/api/matches/:fsMatchId/scoring-preview',
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

        // Proxy to Week-2A endpoint
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
          // Week-2A not available
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

  // ============================================================================
  // GET /scoring/markets - Return list of valid market IDs
  // ============================================================================

  /**
   * GET /api/scoring/markets
   *
   * Returns the list of all valid market IDs supported by the scoring system.
   *
   * @returns {object} Response with success flag and markets array
   */
  fastify.get('/api/scoring/markets', async (request, reply) => {
    return reply.status(200).send({
      success: true,
      markets: VALID_MARKETS,
      count: VALID_MARKETS.length,
    });
  });
}

// Export for backward compatibility
export default registerScoringRoutes;

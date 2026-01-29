/**
 * Scoring Routes - Consolidated (Week-2A + Phase-3A)
 *
 * Week-2A: GET /matches/:id/scoring - Full scoring pipeline
 * Phase-3A: GET /matches/:fsMatchId/scoring-preview - Admin panel preview
 *
 * @author GoalGPT Team
 * @version 2.0.0 (merged)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { featureBuilderService } from '../services/scoring/featureBuilder.service';
import { marketScorerService, type MarketId, type ScoringResult } from '../services/scoring/marketScorer.service';
import { publishEligibilityUtils } from '../services/scoring/publishEligibility';
import { getMatchScoringPreview } from '../services/admin/scoringPreview.service';
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
  // WEEK-2A: Full Scoring Pipeline
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
    '/matches/:id/scoring',
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
  // PHASE-3A: Admin Panel Scoring Preview (Simplified)
  // ============================================================================

  /**
   * GET /api/matches/:fsMatchId/scoring-preview
   *
   * Returns simplified scoring preview for a match (Phase-3A MVP)
   * This is a lightweight endpoint for the admin panel.
   */
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
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to fetch scoring preview',
        });
      }
    }
  );
}

// Export for backward compatibility
export default registerScoringRoutes;

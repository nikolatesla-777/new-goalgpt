/**
 * Scoring Routes - Week-2A Phase 2
 *
 * Provides match scoring API endpoints
 *
 * @author GoalGPT Team
 * @version 1.0.0
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
   * - 500: Server error
   */
  fastify.get<{
    Params: MatchParams;
    Querystring: ScoringQuery;
  }>(
    '/matches/:id/scoring',
    {
      schema: {
        description: 'Get match scoring results for all markets',
        tags: ['Scoring'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'TheSports external match ID' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            markets: {
              type: 'string',
              description: 'Comma-separated market IDs (O25,BTTS,etc.)',
            },
            locale: {
              type: 'string',
              enum: ['tr', 'en'],
              default: 'en',
              description: 'Display locale',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              match_id: { type: 'string' },
              source_refs: { type: 'object' },
              features: { type: 'object' },
              risk_flags: { type: 'array', items: { type: 'string' } },
              results: { type: 'array' },
              generated_at: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: { type: 'object' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: MatchParams; Querystring: ScoringQuery }>, reply: FastifyReply) => {
      const { id: matchId } = request.params;
      const { markets: marketsQuery, locale = 'en' } = request.query;

      const startTime = Date.now();

      logger.info('[ScoringAPI] Scoring request', {
        matchId,
        markets: marketsQuery || 'all',
        locale,
      });

      try {
        // ========================================================================
        // STEP 1: Parse and validate markets
        // ========================================================================

        let requestedMarkets: MarketId[] = VALID_MARKETS;

        if (marketsQuery) {
          const marketIds = marketsQuery.split(',').map(m => m.trim().toUpperCase());

          // Validate each market ID
          const invalidMarkets = marketIds.filter(m => !VALID_MARKETS.includes(m as MarketId));

          if (invalidMarkets.length > 0) {
            return reply.status(400).send({
              error: 'Invalid market IDs',
              details: {
                invalid: invalidMarkets,
                allowed: VALID_MARKETS,
              },
            });
          }

          requestedMarkets = marketIds as MarketId[];
        }

        // ========================================================================
        // STEP 2: Build composite scoring features
        // ========================================================================

        let compositeFeatures;

        try {
          compositeFeatures = await featureBuilderService.buildScoringFeatures(matchId);
        } catch (error) {
          if (error instanceof Error && error.message.includes('not found')) {
            return reply.status(404).send({
              error: `Match not found: ${matchId}`,
            });
          }
          throw error;
        }

        const { features, source_refs, risk_flags } = compositeFeatures;

        // ========================================================================
        // STEP 3: Score all requested markets
        // ========================================================================

        // Adapt ScoringFeatures to FootyStatsMatch format for marketScorer
        const footyStatsFormat = marketScorerService.adaptScoringFeaturesToFootyStats(features);

        const results: ScoringResultWithEligibility[] = [];

        for (const marketId of requestedMarkets) {
          try {
            const result = await marketScorerService.scoreMarket(marketId, footyStatsFormat);

            // Attach publish eligibility
            const eligibility = publishEligibilityUtils.canPublish(marketId, result);

            results.push({
              ...result,
              can_publish: eligibility.canPublish,
              publish_reason: eligibility.reason,
              failed_checks: eligibility.failedChecks,
              passed_checks: eligibility.passedChecks,
            });
          } catch (error) {
            logger.error('[ScoringAPI] Error scoring market', {
              matchId,
              marketId,
              error: error instanceof Error ? error.message : String(error),
            });

            // Add error result for this market
            results.push({
              match_id: matchId,
              fs_match_id: 0,
              market_id: marketId,
              market_name: marketId,
              probability: 0,
              confidence: 0,
              pick: 'NO',
              edge: null,
              components: [],
              risk_flags: ['SCORING_ERROR'],
              data_score: 0,
              metadata: {},
              scored_at: Date.now(),
              can_publish: false,
              publish_reason: 'Scoring error occurred',
              failed_checks: ['SCORING_ERROR'],
              passed_checks: [],
            } as any);
          }
        }

        // ========================================================================
        // STEP 4: Build response
        // ========================================================================

        const response: ScoringResponse = {
          match_id: matchId,
          source_refs,
          features,
          risk_flags,
          results,
          generated_at: Date.now(),
        };

        const duration = Date.now() - startTime;

        logger.info('[ScoringAPI] Scoring complete', {
          matchId,
          markets_scored: results.length,
          footystats_linked: source_refs.footystats_linked,
          risk_flags: risk_flags.length,
          duration_ms: duration,
        });

        return reply.send(response);
      } catch (error) {
        logger.error('[ScoringAPI] Fatal error', {
          matchId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return reply.status(500).send({
          error: 'Internal server error',
          details: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  /**
   * GET /api/scoring/markets
   *
   * Get list of available markets
   *
   * Response:
   * {
   *   markets: [
   *     { id: 'O25', display_name: 'Over 2.5 Goals', display_name_tr: '2.5 Üst Gol' },
   *     ...
   *   ]
   * }
   */
  fastify.get(
    '/scoring/markets',
    {
      schema: {
        description: 'Get list of available markets',
        tags: ['Scoring'],
        response: {
          200: {
            type: 'object',
            properties: {
              markets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    display_name: { type: 'string' },
                    display_name_tr: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Load market definitions from registry
      const marketRegistry = require('../config/market_registry.json');

      const markets = VALID_MARKETS.map(id => ({
        id,
        display_name: marketRegistry.markets[id]?.display_name || id,
        display_name_tr: marketRegistry.markets[id]?.display_name_tr || id,
      }));

      return reply.send({ markets });
    }
  );

  logger.info('[ScoringAPI] Scoring routes registered');
}

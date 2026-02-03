/**
 * Telegram Match Analysis Routes
 *
 * Routes for generating AI-powered match analysis
 */

import { FastifyInstance } from 'fastify';
import { pool, safeQuery } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  generateMatchAnalysis,
  formatAnalysisForTelegram,
  formatAnalysisForCopy,
} from '../../services/analysis/matchAnalysisGenerator.service';

/**
 * Register analysis routes
 */
export async function registerAnalysisRoutes(fastify: FastifyInstance) {
  /**
   * POST /telegram/analysis/match/:matchId
   *
   * Generate analysis for a specific match
   */
  fastify.post('/telegram/analysis/match/:matchId', async (request, reply) => {
    const { matchId } = request.params as { matchId: string };

    logger.info(`[AnalysisRoutes] Generating analysis for match ${matchId}`);

    try {
      // Fetch match data from FootyStats
      const matchQuery = `
        SELECT
          m.id,
          m.home_name,
          m.away_name,
          m.competition_name,
          m.date_unix,
          m.btts_potential,
          m.o25_potential,
          m.o15_potential,
          m.team_a_xg_prematch,
          m.team_b_xg_prematch,
          m.corners_potential,
          m.cards_potential,
          m.shots_potential,
          m.fouls_potential,
          m.odds_ft_1,
          m.odds_ft_x,
          m.odds_ft_2,
          m.h2h,
          m.trends
        FROM footystats_match m
        WHERE m.id = $1
      `;

      const matchResult = await safeQuery(matchQuery, [parseInt(matchId)]);

      if (matchResult.length === 0) {
        return reply.status(404).send({
          error: 'Match not found',
          message: `Match with ID ${matchId} does not exist`,
        });
      }

      const match = matchResult[0];

      // Generate analysis
      const analysis = generateMatchAnalysis({
        home_name: match.home_name,
        away_name: match.away_name,
        competition_name: match.competition_name,
        date_unix: match.date_unix,
        btts_potential: match.btts_potential,
        o25_potential: match.o25_potential,
        o15_potential: match.o15_potential,
        team_a_xg_prematch: match.team_a_xg_prematch,
        team_b_xg_prematch: match.team_b_xg_prematch,
        corners_potential: match.corners_potential,
        cards_potential: match.cards_potential,
        shots_potential: match.shots_potential,
        fouls_potential: match.fouls_potential,
        odds_ft_1: match.odds_ft_1,
        odds_ft_x: match.odds_ft_x,
        odds_ft_2: match.odds_ft_2,
        h2h: match.h2h,
        trends: match.trends,
      });

      // Format for different use cases
      const telegramFormat = formatAnalysisForTelegram(analysis);
      const copyFormat = formatAnalysisForCopy(analysis);

      logger.info(`[AnalysisRoutes] ✅ Analysis generated successfully for ${match.home_name} vs ${match.away_name}`);

      return {
        success: true,
        match: {
          id: match.id,
          home_name: match.home_name,
          away_name: match.away_name,
          competition_name: match.competition_name,
          date_unix: match.date_unix,
        },
        analysis: {
          title: analysis.title,
          fullAnalysis: analysis.fullAnalysis,
          recommendations: analysis.recommendations,
          generatedAt: analysis.generatedAt,
        },
        formatted: {
          telegram: telegramFormat,
          copy: copyFormat,
        },
      };
    } catch (error) {
      logger.error('[AnalysisRoutes] Failed to generate analysis:', error);

      return reply.status(500).send({
        error: 'Analysis generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /telegram/analysis/bulk
   *
   * Generate analysis for multiple matches
   */
  fastify.post('/telegram/analysis/bulk', async (request, reply) => {
    const { matchIds } = request.body as { matchIds: number[] };

    if (!matchIds || !Array.isArray(matchIds) || matchIds.length === 0) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'matchIds array is required and must not be empty',
      });
    }

    if (matchIds.length > 20) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'Maximum 20 matches can be analyzed at once',
      });
    }

    logger.info(`[AnalysisRoutes] Generating bulk analysis for ${matchIds.length} matches`);

    try {
      // Fetch all matches
      const matchQuery = `
        SELECT
          m.id,
          m.home_name,
          m.away_name,
          m.competition_name,
          m.date_unix,
          m.btts_potential,
          m.o25_potential,
          m.o15_potential,
          m.team_a_xg_prematch,
          m.team_b_xg_prematch,
          m.corners_potential,
          m.cards_potential,
          m.shots_potential,
          m.fouls_potential,
          m.odds_ft_1,
          m.odds_ft_x,
          m.odds_ft_2,
          m.h2h,
          m.trends
        FROM footystats_match m
        WHERE m.id = ANY($1)
      `;

      const matches = await safeQuery(matchQuery, [matchIds]);

      if (matches.length === 0) {
        return reply.status(404).send({
          error: 'No matches found',
          message: 'None of the provided match IDs exist',
        });
      }

      // Generate analysis for each match
      const analyses = matches.map((match: any) => {
        const analysis = generateMatchAnalysis({
          home_name: match.home_name,
          away_name: match.away_name,
          competition_name: match.competition_name,
          date_unix: match.date_unix,
          btts_potential: match.btts_potential,
          o25_potential: match.o25_potential,
          o15_potential: match.o15_potential,
          team_a_xg_prematch: match.team_a_xg_prematch,
          team_b_xg_prematch: match.team_b_xg_prematch,
          corners_potential: match.corners_potential,
          cards_potential: match.cards_potential,
          shots_potential: match.shots_potential,
          fouls_potential: match.fouls_potential,
          odds_ft_1: match.odds_ft_1,
          odds_ft_x: match.odds_ft_x,
          odds_ft_2: match.odds_ft_2,
          h2h: match.h2h,
          trends: match.trends,
        });

        return {
          matchId: match.id,
          match: {
            home_name: match.home_name,
            away_name: match.away_name,
            competition_name: match.competition_name,
            date_unix: match.date_unix,
          },
          analysis: {
            title: analysis.title,
            fullAnalysis: analysis.fullAnalysis,
            recommendations: analysis.recommendations,
            generatedAt: analysis.generatedAt,
          },
          formatted: {
            copy: formatAnalysisForCopy(analysis),
          },
        };
      });

      logger.info(`[AnalysisRoutes] ✅ Bulk analysis generated for ${analyses.length} matches`);

      return {
        success: true,
        count: analyses.length,
        analyses,
      };
    } catch (error) {
      logger.error('[AnalysisRoutes] Failed to generate bulk analysis:', error);

      return reply.status(500).send({
        error: 'Bulk analysis generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('[AnalysisRoutes] ✅ Analysis routes registered');
}

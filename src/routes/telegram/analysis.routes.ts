/**
 * Telegram Match Analysis Routes
 *
 * Routes for generating AI-powered match analysis
 */

import { FastifyInstance } from 'fastify';
import { logger } from '../../utils/logger';
import { footyStatsAPI } from '../../services/footystats/footystats.client';
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
      // Fetch match data from FootyStats API
      const response = await footyStatsAPI.getMatchDetails(parseInt(matchId));

      if (!response.success || !response.data) {
        return reply.status(404).send({
          error: 'Match not found',
          message: `Match with ID ${matchId} does not exist in FootyStats`,
        });
      }

      const fsMatch = response.data;

      // DEBUG: Log available fields
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[DEBUG] FootyStats Match Data Keys:', Object.keys(fsMatch).join(', '));
      console.log('[DEBUG] Field Availability:');
      console.log('  btts_potential:', fsMatch.pre_match_teamA_overall_btts_percentage);
      console.log('  o25_potential:', fsMatch.pre_match_teamA_overall_over25_percentage);
      console.log('  o15_potential:', fsMatch.pre_match_teamA_overall_over15_percentage);
      console.log('  ht_over_05:', fsMatch.pre_match_teamA_overall_first_half_goals_for_percentage);
      console.log('  corners:', fsMatch.pre_match_teamA_overall_corners_for_90_per_match);
      console.log('  cards:', fsMatch.pre_match_teamA_overall_cards_for_90_per_match);
      console.log('  h2h:', fsMatch.h2h ? 'YES' : 'NO');
      console.log('  trends:', fsMatch.trends ? 'YES' : 'NO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Map FootyStats data to our format
      const match = {
        id: fsMatch.id,
        home_name: fsMatch.home_name,
        away_name: fsMatch.away_name,
        competition_name: fsMatch.competition_name || fsMatch.league_name || 'Unknown League',
        date_unix: fsMatch.date_unix,
        btts_potential: fsMatch.pre_match_teamA_overall_btts_percentage,
        o25_potential: fsMatch.pre_match_teamA_overall_over25_percentage,
        o15_potential: fsMatch.pre_match_teamA_overall_over15_percentage,
        ht_over_05_potential: fsMatch.pre_match_teamA_overall_first_half_goals_for_percentage,
        team_a_xg_prematch: fsMatch.team_a_xg_prematch,
        team_b_xg_prematch: fsMatch.team_b_xg_prematch,
        team_a_form: fsMatch.team_a_form_string,
        team_b_form: fsMatch.team_b_form_string,
        corners_potential: fsMatch.pre_match_teamA_overall_corners_for_90_per_match,
        cards_potential: fsMatch.pre_match_teamA_overall_cards_for_90_per_match,
        shots_potential: fsMatch.pre_match_teamA_overall_shots_on_target_for_90_per_match,
        fouls_potential: fsMatch.pre_match_teamA_overall_fouls_committed_for_90_per_match,
        odds_ft_1: fsMatch.odds_ft_1,
        odds_ft_x: fsMatch.odds_ft_x,
        odds_ft_2: fsMatch.odds_ft_2,
        h2h: fsMatch.h2h ? {
          total_matches: fsMatch.h2h.total,
          home_wins: fsMatch.h2h.homeWins,
          draws: fsMatch.h2h.draws,
          away_wins: fsMatch.h2h.awayWins,
          btts_pct: fsMatch.h2h.btts_pct,
          avg_goals: fsMatch.h2h.avg_goals,
          over15_pct: fsMatch.h2h.over15_pct,
          over25_pct: fsMatch.h2h.over25_pct,
          over35_pct: fsMatch.h2h.over35_pct,
        } : undefined,
        trends: fsMatch.trends,
      };

      // Generate analysis
      const analysis = generateMatchAnalysis({
        home_name: match.home_name,
        away_name: match.away_name,
        competition_name: match.competition_name,
        date_unix: match.date_unix,
        btts_potential: match.btts_potential,
        o25_potential: match.o25_potential,
        o15_potential: match.o15_potential,
        ht_over_05_potential: match.ht_over_05_potential,
        team_a_xg_prematch: match.team_a_xg_prematch,
        team_b_xg_prematch: match.team_b_xg_prematch,
        team_a_form: match.team_a_form,
        team_b_form: match.team_b_form,
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
   * NOTE: This endpoint fetches each match individually from FootyStats API
   */
  fastify.post('/telegram/analysis/bulk', async (request, reply) => {
    const { matchIds } = request.body as { matchIds: number[] };

    if (!matchIds || !Array.isArray(matchIds) || matchIds.length === 0) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'matchIds array is required and must not be empty',
      });
    }

    if (matchIds.length > 10) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'Maximum 10 matches can be analyzed at once',
      });
    }

    logger.info(`[AnalysisRoutes] Generating bulk analysis for ${matchIds.length} matches`);

    try {
      // Fetch all matches from FootyStats API
      const matchPromises = matchIds.map(id => footyStatsAPI.getMatchDetails(id));
      const matchResponses = await Promise.all(matchPromises);

      const validMatches = matchResponses
        .filter(res => res.success && res.data)
        .map(res => res.data!);

      if (validMatches.length === 0) {
        return reply.status(404).send({
          error: 'No matches found',
          message: 'None of the provided match IDs exist in FootyStats',
        });
      }

      // Generate analysis for each match
      const analyses = validMatches.map((fsMatch: any) => {
        const analysis = generateMatchAnalysis({
          home_name: fsMatch.home_name,
          away_name: fsMatch.away_name,
          competition_name: fsMatch.competition_name || fsMatch.league_name || 'Unknown League',
          date_unix: fsMatch.date_unix,
          btts_potential: fsMatch.pre_match_teamA_overall_btts_percentage,
          o25_potential: fsMatch.pre_match_teamA_overall_over25_percentage,
          o15_potential: fsMatch.pre_match_teamA_overall_over15_percentage,
          ht_over_05_potential: fsMatch.pre_match_teamA_overall_first_half_goals_for_percentage,
          team_a_xg_prematch: fsMatch.team_a_xg_prematch,
          team_b_xg_prematch: fsMatch.team_b_xg_prematch,
          team_a_form: fsMatch.team_a_form_string,
          team_b_form: fsMatch.team_b_form_string,
          corners_potential: fsMatch.pre_match_teamA_overall_corners_for_90_per_match,
          cards_potential: fsMatch.pre_match_teamA_overall_cards_for_90_per_match,
          shots_potential: fsMatch.pre_match_teamA_overall_shots_on_target_for_90_per_match,
          fouls_potential: fsMatch.pre_match_teamA_overall_fouls_committed_for_90_per_match,
          odds_ft_1: fsMatch.odds_ft_1,
          odds_ft_x: fsMatch.odds_ft_x,
          odds_ft_2: fsMatch.odds_ft_2,
          h2h: fsMatch.h2h ? {
            total_matches: fsMatch.h2h.total,
            home_wins: fsMatch.h2h.homeWins,
            draws: fsMatch.h2h.draws,
            away_wins: fsMatch.h2h.awayWins,
            btts_pct: fsMatch.h2h.btts_pct,
            avg_goals: fsMatch.h2h.avg_goals,
            over15_pct: fsMatch.h2h.over15_pct,
            over25_pct: fsMatch.h2h.over25_pct,
            over35_pct: fsMatch.h2h.over35_pct,
          } : undefined,
          trends: fsMatch.trends,
        });

        return {
          matchId: fsMatch.id,
          match: {
            home_name: fsMatch.home_name,
            away_name: fsMatch.away_name,
            competition_name: fsMatch.competition_name || fsMatch.league_name || 'Unknown League',
            date_unix: fsMatch.date_unix,
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

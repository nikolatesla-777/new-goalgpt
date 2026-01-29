/**
 * Diagnostic Routes
 *
 * Admin-only debugging endpoints for system health and data integrity
 * Phase 4: Data Integrity - Match Mapping Diagnostics
 */

import { FastifyInstance } from 'fastify';
import { safeQuery } from '../database/connection';
import { logger } from '../utils/logger';

export async function diagnosticRoutes(fastify: FastifyInstance) {
  /**
   * GET /admin/diagnostics/match-mapping?date=YYYY-MM-DD
   * Show match mapping status for daily lists
   *
   * Returns:
   * - Total matches in daily lists
   * - Matches with verified match_id
   * - Matches missing match_id (mapping failed)
   * - Potential duplicates
   */
  fastify.get('/admin/diagnostics/match-mapping', async (request, reply) => {
    const { date } = request.query as { date?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];

    logger.info(`[Diagnostics] Checking match mapping for ${targetDate}`);

    try {
      // Get all daily list records for the date
      const dailyLists = await safeQuery(
        `SELECT id, market, matches, generated_at, metadata
         FROM telegram_daily_lists
         WHERE DATE(generated_at) = $1
         ORDER BY generated_at DESC
         LIMIT 100`,
        [targetDate]
      );

      if (dailyLists.length === 0) {
        return {
          success: true,
          date: targetDate,
          message: 'No daily lists found for this date',
          stats: { total: 0, mapped: 0, unmapped: 0, mapping_rate: 0 },
        };
      }

      // Analyze mapping status
      const stats = {
        total_matches: 0,
        mapped: 0,
        unmapped: 0,
        mapping_rate: 0,
        by_market: {} as Record<string, { total: number; mapped: number; unmapped: number }>,
      };

      const unmappedMatches: any[] = [];

      dailyLists.forEach((list: any) => {
        const matches = list.matches || [];
        const market = list.market;

        if (!stats.by_market[market]) {
          stats.by_market[market] = { total: 0, mapped: 0, unmapped: 0 };
        }

        matches.forEach((candidate: any) => {
          const match = candidate.match;
          stats.total_matches++;
          stats.by_market[market].total++;

          if (match?.match_id) {
            stats.mapped++;
            stats.by_market[market].mapped++;
          } else {
            stats.unmapped++;
            stats.by_market[market].unmapped++;
            unmappedMatches.push({
              fs_id: match?.fs_id,
              home_name: match?.home_name,
              away_name: match?.away_name,
              league_name: match?.league_name,
              date_unix: match?.date_unix,
              market,
            });
          }
        });
      });

      stats.mapping_rate = stats.total_matches > 0
        ? Math.round((stats.mapped / stats.total_matches) * 100)
        : 0;

      return {
        success: true,
        date: targetDate,
        stats,
        unmapped_sample: unmappedMatches.slice(0, 20), // First 20 unmapped
        total_unmapped: unmappedMatches.length,
        recommendation: stats.mapping_rate < 95
          ? 'WARNING: Mapping rate below 95%. Consider implementing verified ID mapping system.'
          : 'OK: Mapping rate acceptable.',
      };
    } catch (error: any) {
      logger.error('[Diagnostics] Error checking match mapping:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /admin/diagnostics/duplicate-matches?date=YYYY-MM-DD
   * Find potential duplicate matches in daily lists
   */
  fastify.get('/admin/diagnostics/duplicate-matches', async (request, reply) => {
    const { date } = request.query as { date?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const dailyLists = await safeQuery(
        `SELECT id, market, matches
         FROM telegram_daily_lists
         WHERE DATE(generated_at) = $1`,
        [targetDate]
      );

      const matchOccurrences = new Map<number, { count: number; markets: string[] }>();

      dailyLists.forEach((list: any) => {
        const matches = list.matches || [];
        matches.forEach((candidate: any) => {
          const fsId = candidate.match?.fs_id;
          if (fsId) {
            const existing = matchOccurrences.get(fsId) || { count: 0, markets: [] };
            existing.count++;
            existing.markets.push(list.market);
            matchOccurrences.set(fsId, existing);
          }
        });
      });

      const duplicates = Array.from(matchOccurrences.entries())
        .filter(([_, data]) => data.count > 1)
        .map(([fs_id, data]) => ({ fs_id, occurrences: data.count, markets: data.markets }));

      return {
        success: true,
        date: targetDate,
        duplicate_count: duplicates.length,
        duplicates: duplicates.slice(0, 50), // First 50
        note: 'Matches appearing in multiple markets is normal (e.g., OVER_25 + BTTS)',
      };
    } catch (error: any) {
      logger.error('[Diagnostics] Error checking duplicates:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  logger.info('[Diagnostic Routes] Registered diagnostic endpoints');
}

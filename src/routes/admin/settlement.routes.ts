/**
 * Settlement Monitoring Routes
 * API endpoints for settlement metrics and monitoring
 */

import { FastifyPluginAsync } from 'fastify';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';

const settlementRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/admin/settlement/metrics
   * Returns settlement metrics for the last N days
   */
  fastify.get('/metrics', async (request, reply) => {
    try {
      const { days = 7 } = request.query as { days?: number };

      const metrics = await pool.query(
        `SELECT
          list_date,
          COUNT(*) as total_lists,
          COUNT(CASE WHEN status = 'settled' THEN 1 END) as settled_lists,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_lists,
          SUM((settlement_result->>'won')::int) as total_won,
          SUM((settlement_result->>'lost')::int) as total_lost,
          SUM((settlement_result->>'void')::int) as total_void,
          SUM(matches_count) as total_matches,
          COUNT(CASE WHEN settlement_result IS NOT NULL THEN 1 END) as settled_count,
          -- Count unmapped matches (match_id is null in matches JSONB array)
          SUM(
            (SELECT COUNT(*)
             FROM jsonb_array_elements(matches) as match
             WHERE (match->'match'->>'match_id') IS NULL)
          ) as unmapped_count
        FROM telegram_daily_lists
        WHERE list_date >= CURRENT_DATE - $1::int
        GROUP BY list_date
        ORDER BY list_date DESC`,
        [days]
      );

      // Calculate aggregated metrics
      const aggregated = {
        totalLists: 0,
        settledLists: 0,
        partialLists: 0,
        totalMatches: 0,
        wonMatches: 0,
        lostMatches: 0,
        voidMatches: 0,
        unmappedMatches: 0,
        winRate: 0,
        mappingRate: 0,
        settlementRate: 0,
      };

      metrics.rows.forEach((row) => {
        aggregated.totalLists += parseInt(row.total_lists, 10);
        aggregated.settledLists += parseInt(row.settled_lists, 10);
        aggregated.partialLists += parseInt(row.partial_lists, 10);
        aggregated.totalMatches += parseInt(row.total_matches || '0', 10);
        aggregated.wonMatches += parseInt(row.total_won || '0', 10);
        aggregated.lostMatches += parseInt(row.total_lost || '0', 10);
        aggregated.voidMatches += parseInt(row.total_void || '0', 10);
        aggregated.unmappedMatches += parseInt(row.unmapped_count || '0', 10);
      });

      // Calculate rates
      const settledMatches = aggregated.wonMatches + aggregated.lostMatches;
      aggregated.winRate = settledMatches > 0
        ? Math.round((aggregated.wonMatches / settledMatches) * 100)
        : 0;

      aggregated.mappingRate = aggregated.totalMatches > 0
        ? Math.round(((aggregated.totalMatches - aggregated.unmappedMatches) / aggregated.totalMatches) * 100)
        : 0;

      aggregated.settlementRate = aggregated.totalLists > 0
        ? Math.round((aggregated.settledLists / aggregated.totalLists) * 100)
        : 0;

      return {
        success: true,
        period: {
          days,
          start: metrics.rows.length > 0 ? metrics.rows[metrics.rows.length - 1].list_date : null,
          end: metrics.rows.length > 0 ? metrics.rows[0].list_date : null,
        },
        aggregated,
        history: metrics.rows.map((row) => ({
          date: row.list_date,
          totalLists: parseInt(row.total_lists, 10),
          settledLists: parseInt(row.settled_lists, 10),
          partialLists: parseInt(row.partial_lists, 10),
          wonMatches: parseInt(row.total_won || '0', 10),
          lostMatches: parseInt(row.total_lost || '0', 10),
          voidMatches: parseInt(row.total_void || '0', 10),
          totalMatches: parseInt(row.total_matches || '0', 10),
          unmappedMatches: parseInt(row.unmapped_count || '0', 10),
          winRate: (parseInt(row.total_won || '0', 10) + parseInt(row.total_lost || '0', 10)) > 0
            ? Math.round((parseInt(row.total_won || '0', 10) / (parseInt(row.total_won || '0', 10) + parseInt(row.total_lost || '0', 10))) * 100)
            : 0,
        })),
      };
    } catch (error: any) {
      logger.error('[SettlementMetrics] Error fetching metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch settlement metrics',
        message: error.message,
      });
    }
  });
};

export default settlementRoutes;

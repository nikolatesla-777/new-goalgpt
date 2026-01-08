/**
 * Match Routes
 * 
 * Fastify route definitions for match-related endpoints
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getMatchRecentList,
  getMatchDiary,
  getMatchDetailLive,
  getMatchSeasonRecent,
  getMatchLineup,
  getMatchTeamStats,
  getMatchPlayerStats,
  getLiveMatches,
  getShouldBeLiveMatches,
  getMatchAnalysis,
  getMatchTrend,
  getMatchHalfStats,
  getMatchLiveStats,
  getMatchIncidents,
  triggerPreSync,
  getMatchH2H,
  getMatchById,
  getUnifiedMatches,
} from '../controllers/match.controller';

export default async function matchRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  /**
   * GET /api/matches/recent
   * Get recent matches list
   */
  fastify.get('/recent', getMatchRecentList);

  /**
   * GET /api/matches/diary
   * Get match diary for a specific date (default: today)
   */
  fastify.get('/diary', getMatchDiary);

  /**
   * GET /api/matches/live
   * Phase 5-S Fix: Get STRICTLY live matches (status IN (2,3,4,5,7) only)
   * NO "should be live" matches (status=1) - those are handled by watchdog
   */
  fastify.get('/live', getLiveMatches);

  /**
   * GET /api/matches/unified
   * Phase 6: Unified endpoint - single API call for frontend
   *
   * Query params:
   * - date: YYYY-MM-DD or YYYYMMDD (default: today)
   * - include_live: boolean (default: true) - include cross-day live matches
   * - status: comma-separated status IDs (optional) - filter by status
   *
   * Features:
   * - Merges diary + live data server-side
   * - Handles cross-day matches automatically
   * - Uses smart cache with event-driven invalidation
   */
  fastify.get('/unified', getUnifiedMatches);

  /**
   * GET /api/matches/should-be-live
   * Phase 5-S: Ops/debug endpoint for matches that should be live (status=1 but match_time passed)
   * Query params: maxMinutesAgo (default 120), limit (default 200)
   * NOT used by frontend - only for ops/debug visibility and watchdog input
   */
  fastify.get('/should-be-live', getShouldBeLiveMatches);

  /**
   * GET /api/matches/season/recent
   * Get match season recent
   */
  fastify.get('/season/recent', getMatchSeasonRecent);

  /**
   * POST /api/matches/admin/pre-sync
   * Trigger pre-sync for today's matches (H2H, lineups, standings, compensation)
   * Long-running operation - timeout handled by Fastify default (30s) or nginx
   */
  fastify.post('/admin/pre-sync', {
    schema: {
      // No timeout in schema, handled at server level
    },
  }, triggerPreSync);

  /**
   * GET /api/matches/:match_id/detail-live
   * Get match detail live
   * NOTE: Must be registered before /:match_id route to avoid route conflicts
   */
  fastify.get('/:match_id/detail-live', getMatchDetailLive);

  /**
   * GET /api/matches/:match_id/lineup
   * Get match lineup
   */
  fastify.get('/:match_id/lineup', getMatchLineup);

  /**
   * GET /api/matches/:match_id/team-stats
   * Get match team stats
   */
  fastify.get('/:match_id/team-stats', getMatchTeamStats);

  /**
   * GET /api/matches/:match_id/player-stats
   * Get match player stats
   */
  fastify.get('/:match_id/player-stats', getMatchPlayerStats);

  /**
   * GET /api/matches/:match_id/analysis
   * Get match analysis (H2H, historical confrontation)
   */
  fastify.get('/:match_id/analysis', getMatchAnalysis);

  /**
   * GET /api/matches/:match_id/h2h
   * Get match H2H data (from database with API fallback)
   */
  fastify.get('/:match_id/h2h', getMatchH2H);

  /**
   * GET /api/matches/:match_id/trend
   * Get match trend (minute-by-minute data)
   */
  fastify.get('/:match_id/trend', getMatchTrend);

  /**
   * GET /api/matches/:match_id/half-stats
   * Get match half-time stats (first/second half statistics)
   */
  fastify.get('/:match_id/half-stats', getMatchHalfStats);

  /**
   * GET /api/matches/:match_id/live-stats
   * Get match live stats (from detail_live feed - real-time stats)
   * NOTE: Must be registered before /:match_id route to avoid route conflicts
   */
  fastify.get('/:match_id/live-stats', getMatchLiveStats);

  /**
   * GET /api/matches/:match_id/incidents
   * Get match incidents (optimized for Events tab)
   * Returns incidents (goals, cards, substitutions) for a specific match.
   * Uses database-first strategy with API fallback (97% faster than old endpoint)
   * NOTE: Must be registered before /:match_id route to avoid route conflicts
   */
  fastify.get('/:match_id/incidents', getMatchIncidents);

  /**
   * GET /api/matches/:match_id
   * Get single match by ID (from database)
   * CRITICAL: This endpoint allows fetching matches from any date, not just today
   * NOTE: Must be registered LAST as a catch-all route for match IDs
   */
  fastify.get('/:match_id', getMatchById);
}

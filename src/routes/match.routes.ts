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
   * GET /api/matches/:match_id/detail-live
   * Get match detail live
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
   */
  fastify.get('/:match_id/live-stats', getMatchLiveStats);
}


"use strict";
/**
 * Match Routes
 *
 * Fastify route definitions for match-related endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = matchRoutes;
const match_controller_1 = require("../controllers/match.controller");
const forceRefreshStuck_controller_1 = require("../controllers/match/forceRefreshStuck.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
async function matchRoutes(fastify, options) {
    /**
     * GET /api/matches/recent
     * Get recent matches list
     */
    fastify.get('/recent', match_controller_1.getMatchRecentList);
    /**
     * GET /api/matches/diary
     * Get match diary for a specific date (default: today)
     */
    fastify.get('/diary', match_controller_1.getMatchDiary);
    /**
     * GET /api/matches/live
     * Phase 5-S Fix: Get STRICTLY live matches (status IN (2,3,4,5,7) only)
     * NO "should be live" matches (status=1) - those are handled by watchdog
     */
    fastify.get('/live', match_controller_1.getLiveMatches);
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
    fastify.get('/unified', match_controller_1.getUnifiedMatches);
    /**
     * GET /api/matches/should-be-live
     * Phase 5-S: Ops/debug endpoint for matches that should be live (status=1 but match_time passed)
     * Query params: maxMinutesAgo (default 120), limit (default 200)
     * NOT used by frontend - only for ops/debug visibility and watchdog input
     */
    fastify.get('/should-be-live', match_controller_1.getShouldBeLiveMatches);
    /**
     * GET /api/matches/season/recent
     * Get match season recent
     */
    fastify.get('/season/recent', match_controller_1.getMatchSeasonRecent);
    /**
     * POST /api/matches/admin/pre-sync
     * Trigger pre-sync for today's matches (H2H, lineups, standings, compensation)
     * Long-running operation - timeout handled by Fastify default (30s) or nginx
     * SECURITY: Admin-only endpoint
     */
    fastify.post('/admin/pre-sync', {
        preHandler: [auth_middleware_1.requireAuth, auth_middleware_1.requireAdmin],
        schema: {
        // No timeout in schema, handled at server level
        },
    }, match_controller_1.triggerPreSync);
    /**
     * GET /api/matches/:match_id/detail-live
     * Get match detail live
     * NOTE: Must be registered before /:match_id route to avoid route conflicts
     */
    fastify.get('/:match_id/detail-live', match_controller_1.getMatchDetailLive);
    /**
     * GET /api/matches/:match_id/lineup
     * Get match lineup
     */
    fastify.get('/:match_id/lineup', match_controller_1.getMatchLineup);
    /**
     * GET /api/matches/:match_id/team-stats
     * Get match team stats
     */
    fastify.get('/:match_id/team-stats', match_controller_1.getMatchTeamStats);
    /**
     * GET /api/matches/:match_id/player-stats
     * Get match player stats
     */
    fastify.get('/:match_id/player-stats', match_controller_1.getMatchPlayerStats);
    /**
     * GET /api/matches/:match_id/analysis
     * Get match analysis (H2H, historical confrontation)
     */
    fastify.get('/:match_id/analysis', match_controller_1.getMatchAnalysis);
    /**
     * GET /api/matches/:match_id/h2h
     * Get match H2H data (from database with API fallback)
     */
    fastify.get('/:match_id/h2h', match_controller_1.getMatchH2H);
    /**
     * GET /api/matches/:match_id/trend
     * Get match trend (minute-by-minute data)
     */
    fastify.get('/:match_id/trend', match_controller_1.getMatchTrend);
    /**
     * GET /api/matches/:match_id/half-stats
     * Get match half-time stats (first/second half statistics)
     */
    fastify.get('/:match_id/half-stats', match_controller_1.getMatchHalfStats);
    /**
     * GET /api/matches/:match_id/live-stats
     * Get match live stats (from detail_live feed - real-time stats)
     * NOTE: Must be registered before /:match_id route to avoid route conflicts
     */
    fastify.get('/:match_id/live-stats', match_controller_1.getMatchLiveStats);
    /**
     * GET /api/matches/:match_id/incidents
     * Get match incidents (optimized for Events tab)
     * Returns incidents (goals, cards, substitutions) for a specific match.
     * Uses database-first strategy with API fallback (97% faster than old endpoint)
     * NOTE: Must be registered before /:match_id route to avoid route conflicts
     */
    fastify.get('/:match_id/incidents', match_controller_1.getMatchIncidents);
    /**
     * GET /api/matches/:match_id/full
     * PERF FIX Phase 2: Unified endpoint - returns ALL match detail data in single call
     * Reduces frontend from 6 API calls to 1 API call
     * Server-side parallel fetch with 2s global timeout
     * NOTE: Must be registered before /:match_id route to avoid route conflicts
     */
    fastify.get('/:match_id/full', match_controller_1.getMatchFull);
    /**
     * POST /api/matches/force-refresh-stuck
     * Force refresh matches stuck at 90+ minutes
     * Uses /match/detail_live to get latest status and finish matches
     * MQTT-only mode solution for matches without MQTT coverage
     */
    fastify.post('/force-refresh-stuck', forceRefreshStuck_controller_1.forceRefreshStuckMatches);
    /**
     * POST /api/matches/:match_id/force-refresh
     * Force refresh a single match by ID
     * Uses /match/detail_live to get latest status
     * Useful for manual refresh of stuck matches
     */
    fastify.post('/:match_id/force-refresh', forceRefreshStuck_controller_1.forceRefreshMatch);
    /**
     * GET /api/matches/:match_id
     * Get single match by ID (from database)
     * CRITICAL: This endpoint allows fetching matches from any date, not just today
     * NOTE: Must be registered LAST as a catch-all route for match IDs
     */
    fastify.get('/:match_id', match_controller_1.getMatchById);
}

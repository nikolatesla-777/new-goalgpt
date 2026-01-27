"use strict";
/**
 * Match Routes
 *
 * Fastify route definitions for match-related endpoints
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = matchRoutes;
// PR-11: Deprecation utilities
var deprecation_utils_1 = require("../utils/deprecation.utils");
var match_controller_1 = require("../controllers/match.controller");
var forceRefreshStuck_controller_1 = require("../controllers/match/forceRefreshStuck.controller");
var auth_middleware_1 = require("../middleware/auth.middleware");
// PR-10: Schema validation
var validation_middleware_1 = require("../middleware/validation.middleware");
var match_schema_1 = require("../schemas/match.schema");
function matchRoutes(fastify, options) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
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
             *
             * PR-11: DEPRECATED - Legacy endpoint for backwards compatibility
             * @deprecated Use GET /api/matches/:match_id/h2h instead
             * @sunset 2026-02-23
             */
            fastify.get('/:match_id/analysis', function (request, reply) { return __awaiter(_this, void 0, void 0, function () {
                var match_id;
                return __generator(this, function (_a) {
                    match_id = request.params.match_id;
                    // PR-11: Add deprecation headers
                    (0, deprecation_utils_1.deprecateRoute)(request, reply, {
                        canonical: "/api/matches/".concat(match_id, "/h2h"),
                        sunset: '2026-02-23T00:00:00Z',
                        docs: 'https://docs.goalgpt.app/api/matches/h2h',
                        message: 'The /analysis endpoint is deprecated. Use /h2h for faster, database-first H2H data.'
                    });
                    // Redirect to canonical H2H handler
                    return [2 /*return*/, (0, match_controller_1.getMatchH2H)(request, reply)];
                });
            }); });
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
            // PR-10: Validate params
            fastify.post('/:match_id/force-refresh', { preHandler: [(0, validation_middleware_1.validate)({ params: match_schema_1.matchIdParamSchema })] }, forceRefreshStuck_controller_1.forceRefreshMatch);
            /**
             * GET /api/matches/:match_id
             * Get single match by ID (from database)
             * CRITICAL: This endpoint allows fetching matches from any date, not just today
             * NOTE: Must be registered LAST as a catch-all route for match IDs
             */
            fastify.get('/:match_id', match_controller_1.getMatchById);
            return [2 /*return*/];
        });
    });
}

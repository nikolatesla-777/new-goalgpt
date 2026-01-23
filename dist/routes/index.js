"use strict";
/**
 * Central Route Registration - PR-2: Auth Grouping
 *
 * Route groups with hook-level authentication.
 * Auth is applied ONLY at ROUTE GROUP level via addHook('preHandler', ...), NOT per-route.
 *
 * Route Groups:
 * - publicAPI - read-only endpoints, no authentication required
 * - authAPI - user endpoints requiring JWT authentication
 * - adminAPI - admin endpoints requiring JWT + admin role
 * - internalAPI - internal monitoring endpoints (localhost OR X-Internal-Secret header)
 * - wsAPI - WebSocket routes (first-message auth within 10s, handled in websocket.routes.ts)
 * - mixedAuthAPI - routes with mixed public/protected endpoints (auth handled internally per-route)
 *
 * IMPORTANT: All existing /api/* paths are preserved for backward compatibility (NO breaking changes).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
// Middleware
const auth_middleware_1 = require("../middleware/auth.middleware");
const internal_middleware_1 = require("../middleware/internal.middleware");
// Core Match & Team Data
const match_routes_1 = __importDefault(require("./match.routes"));
const season_routes_1 = __importDefault(require("./season.routes"));
const team_routes_1 = __importDefault(require("./team.routes"));
const player_routes_1 = __importDefault(require("./player.routes"));
const league_routes_1 = __importDefault(require("./league.routes"));
// Health & Monitoring
const health_routes_1 = require("./health.routes");
const metrics_routes_1 = __importDefault(require("./metrics.routes"));
// WebSocket
const websocket_routes_1 = __importDefault(require("./websocket.routes"));
// AI Predictions (mixed patterns - TODO: unify in PR-2+)
const prediction_routes_1 = require("./prediction.routes");
const predictionUnlock_routes_1 = require("./predictionUnlock.routes");
// Dashboard
const dashboard_routes_1 = require("./dashboard.routes");
// Authentication & Authorization
const auth_routes_1 = require("./auth.routes");
// Gamification Systems (Phase 2-3)
const xp_routes_1 = require("./xp.routes");
const credits_routes_1 = require("./credits.routes");
const badges_routes_1 = require("./badges.routes");
const referrals_routes_1 = require("./referrals.routes");
const dailyRewards_routes_1 = require("./dailyRewards.routes");
// Social & Community Features
const comments_routes_1 = require("./comments.routes");
const forum_routes_1 = __importDefault(require("./forum.routes"));
// Admin & Moderation
const announcements_routes_1 = require("./announcements.routes");
// External Integrations
const footystats_routes_1 = require("./footystats.routes");
const partners_routes_1 = require("./partners.routes");
// ============================================================================
// CENTRAL REGISTRATION FUNCTION
// ============================================================================
/**
 * Register all application routes with hook-level authentication
 *
 * Called ONCE from server.ts bootstrap.
 * All route registration logic lives here.
 *
 * @param app - Fastify instance
 */
async function registerRoutes(app) {
    // ============================================================================
    // PUBLIC API GROUP
    // Read-only endpoints, no authentication required
    // Prefix: /api/*
    // ============================================================================
    await app.register(async (publicAPI) => {
        // No auth hook - these are public endpoints
        // Health checks (must be public for load balancer)
        publicAPI.register(health_routes_1.healthRoutes, { prefix: '/api' });
        // Core read-only data
        publicAPI.register(match_routes_1.default, { prefix: '/api/matches' });
        publicAPI.register(season_routes_1.default, { prefix: '/api/seasons' });
        publicAPI.register(team_routes_1.default, { prefix: '/api/teams' });
        publicAPI.register(player_routes_1.default, { prefix: '/api/players' });
        publicAPI.register(league_routes_1.default, { prefix: '/api/leagues' });
        // Prediction viewing (read-only)
        publicAPI.register(prediction_routes_1.predictionRoutes);
    });
    // ============================================================================
    // AUTHENTICATED API GROUP
    // User endpoints requiring valid JWT token
    // Prefix: /api/*
    // ============================================================================
    await app.register(async (authAPI) => {
        // Apply auth hook to ALL routes in this group
        authAPI.addHook('preHandler', auth_middleware_1.requireAuth);
        // Gamification systems
        authAPI.register(xp_routes_1.xpRoutes, { prefix: '/api/xp' });
        authAPI.register(credits_routes_1.creditsRoutes, { prefix: '/api/credits' });
        authAPI.register(badges_routes_1.badgesRoutes, { prefix: '/api/badges' });
        authAPI.register(referrals_routes_1.referralsRoutes, { prefix: '/api/referrals' });
        authAPI.register(dailyRewards_routes_1.dailyRewardsRoutes, { prefix: '/api/daily-rewards' });
        // Social features
        authAPI.register(comments_routes_1.commentsRoutes, { prefix: '/api/comments' });
        authAPI.register(forum_routes_1.default, { prefix: '/api/forum' });
        // Prediction unlock (credit-based)
        authAPI.register(predictionUnlock_routes_1.predictionUnlockRoutes, { prefix: '/api/predictions' });
    });
    // ============================================================================
    // ADMIN API GROUP
    // Admin endpoints requiring valid JWT token + admin role
    // Prefix: /api/*
    // ============================================================================
    await app.register(async (adminAPI) => {
        // Apply auth hooks to ALL routes in this group
        adminAPI.addHook('preHandler', auth_middleware_1.requireAuth);
        adminAPI.addHook('preHandler', auth_middleware_1.requireAdmin);
        // Admin dashboard
        adminAPI.register(dashboard_routes_1.dashboardRoutes);
        // Admin moderation
        adminAPI.register(announcements_routes_1.announcementsRoutes, { prefix: '/api/announcements' });
        // Partner management
        adminAPI.register(partners_routes_1.partnersRoutes, { prefix: '/api/partners' });
    });
    // ============================================================================
    // INTERNAL API GROUP
    // Internal monitoring endpoints
    // Requires X-Internal-Secret header OR localhost
    // Prefix: /api/metrics
    // ============================================================================
    await app.register(async (internalAPI) => {
        // Apply internal auth hook to ALL routes in this group
        internalAPI.addHook('preHandler', internal_middleware_1.requireInternal);
        // Monitoring endpoints
        internalAPI.register(metrics_routes_1.default, { prefix: '/api/metrics' });
    });
    // ============================================================================
    // WEBSOCKET ROUTES
    // WebSocket connections with first-message authentication
    // Prefix: /ws
    // ============================================================================
    // WebSocket auth is handled inside websocket.routes.ts
    // First message must contain valid JWT within 10 seconds
    app.register(websocket_routes_1.default);
    // ============================================================================
    // MIXED AUTH API GROUP
    // Routes with mixed public/protected endpoints
    // Auth handled internally per-route (cannot use group hooks)
    // Prefix: /api/*
    // ============================================================================
    // Auth routes: /login, /register are public; /me, /refresh require auth
    app.register(auth_routes_1.authRoutes, { prefix: '/api/auth' });
    // FootyStats integration (may have mixed endpoints)
    app.register(footystats_routes_1.footyStatsRoutes, { prefix: '/api' });
}

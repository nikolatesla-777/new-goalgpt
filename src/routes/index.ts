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

import { FastifyInstance } from 'fastify';

// Middleware
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { requireInternal } from '../middleware/internal.middleware';

// Core Match & Team Data
import matchRoutes from './match.routes';
import seasonRoutes from './season.routes';
import teamRoutes from './team.routes';
import playerRoutes from './player.routes';
import leagueRoutes from './league.routes';

// Health & Monitoring
import { healthRoutes } from './health.routes';
import metricsRoutes from './metrics.routes';

// WebSocket
import websocketRoutes from './websocket.routes';

// AI Predictions (mixed patterns - TODO: unify in PR-2+)
import { predictionRoutes } from './prediction.routes';
import { predictionUnlockRoutes } from './predictionUnlock.routes';

// Dashboard
import { dashboardRoutes } from './dashboard.routes';

// Authentication & Authorization
import { authRoutes } from './auth.routes';

// Gamification Systems (Phase 2-3)
import { xpRoutes } from './xp.routes';
import { creditsRoutes } from './credits.routes';
import { badgesRoutes } from './badges.routes';
import { referralsRoutes } from './referrals.routes';
import { dailyRewardsRoutes } from './dailyRewards.routes';

// Social & Community Features
import { commentsRoutes } from './comments.routes';
import forumRoutes from './forum.routes';

// Admin & Moderation
import { announcementsRoutes } from './announcements.routes';
import { diagnosticRoutes } from './diagnostic.routes';

// External Integrations
import { footyStatsRoutes } from './footystats.routes';
import { partnersRoutes } from './partners.routes';
import { telegramRoutes } from './telegram.routes';

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
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================================
  // PUBLIC API GROUP
  // Read-only endpoints, no authentication required
  // Prefix: /api/*
  // ============================================================================
  await app.register(async (publicAPI) => {
    // No auth hook - these are public endpoints

    // Health checks (must be public for load balancer)
    publicAPI.register(healthRoutes, { prefix: '/api' });

    // Core read-only data
    publicAPI.register(matchRoutes, { prefix: '/api/matches' });
    publicAPI.register(seasonRoutes, { prefix: '/api/seasons' });
    publicAPI.register(teamRoutes, { prefix: '/api/teams' });
    publicAPI.register(playerRoutes, { prefix: '/api/players' });
    publicAPI.register(leagueRoutes, { prefix: '/api/leagues' });

    // Prediction viewing (read-only)
    publicAPI.register(predictionRoutes);
  });

  // ============================================================================
  // AUTHENTICATED API GROUP
  // User endpoints requiring valid JWT token
  // Prefix: /api/*
  // ============================================================================
  await app.register(async (authAPI) => {
    // Apply auth hook to ALL routes in this group
    authAPI.addHook('preHandler', requireAuth);

    // Gamification systems
    authAPI.register(xpRoutes, { prefix: '/api/xp' });
    authAPI.register(creditsRoutes, { prefix: '/api/credits' });
    authAPI.register(badgesRoutes, { prefix: '/api/badges' });
    authAPI.register(referralsRoutes, { prefix: '/api/referrals' });
    authAPI.register(dailyRewardsRoutes, { prefix: '/api/daily-rewards' });

    // Social features
    authAPI.register(commentsRoutes, { prefix: '/api/comments' });
    authAPI.register(forumRoutes, { prefix: '/api/forum' });

    // Prediction unlock (credit-based)
    authAPI.register(predictionUnlockRoutes, { prefix: '/api/predictions' });
  });

  // ============================================================================
  // ADMIN API GROUP
  // Admin endpoints requiring valid JWT token + admin role
  // Prefix: /api/*
  // ============================================================================
  await app.register(async (adminAPI) => {
    // Apply auth hooks to ALL routes in this group
    adminAPI.addHook('preHandler', requireAuth);
    adminAPI.addHook('preHandler', requireAdmin);

    // Admin dashboard
    adminAPI.register(dashboardRoutes);

    // Admin moderation
    adminAPI.register(announcementsRoutes, { prefix: '/api/announcements' });

    // Partner management
    adminAPI.register(partnersRoutes, { prefix: '/api/partners' });

    // System diagnostics (Phase 4: Data Integrity)
    adminAPI.register(diagnosticRoutes, { prefix: '/api' });
  });

  // ============================================================================
  // INTERNAL API GROUP
  // Internal monitoring endpoints
  // Requires X-Internal-Secret header OR localhost
  // Prefix: /api/metrics
  // ============================================================================
  await app.register(async (internalAPI) => {
    // Apply internal auth hook to ALL routes in this group
    internalAPI.addHook('preHandler', requireInternal);

    // Monitoring endpoints
    internalAPI.register(metricsRoutes, { prefix: '/api/metrics' });
  });

  // ============================================================================
  // WEBSOCKET ROUTES
  // WebSocket connections with first-message authentication
  // Prefix: /ws
  // ============================================================================
  // WebSocket auth is handled inside websocket.routes.ts
  // First message must contain valid JWT within 10 seconds
  app.register(websocketRoutes);

  // ============================================================================
  // MIXED AUTH API GROUP
  // Routes with mixed public/protected endpoints
  // Auth handled internally per-route (cannot use group hooks)
  // Prefix: /api/*
  // ============================================================================
  // Auth routes: /login, /register are public; /me, /refresh require auth
  app.register(authRoutes, { prefix: '/api/auth' });

  // FootyStats integration (may have mixed endpoints)
  app.register(footyStatsRoutes, { prefix: '/api' });

  // Telegram publishing (TEMPORARY: PUBLIC for development, will add auth later)
  app.register(telegramRoutes, { prefix: '/api' });
}

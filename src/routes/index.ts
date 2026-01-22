/**
 * Central Route Registration
 *
 * SINGLE SOURCE OF TRUTH for all Fastify route registrations.
 * This is the ONLY file where fastify.register() should be called.
 *
 * Organization:
 * - Routes grouped by domain for clarity
 * - Prefixes preserved from original implementation
 * - NO auth/permission changes (deferred to PR-2)
 * - NO prefix restructuring (deferred to future PRs)
 *
 * TECHNICAL DEBT (marked for PR-2+):
 * - Mixed auth handling (some routes have requireAuth, some don't)
 * - Inconsistent prefix patterns (/api/predictions vs no prefix for predictionRoutes)
 * - No group-level hooks yet
 */

import { FastifyInstance } from 'fastify';

// ============================================================================
// ROUTE IMPORTS
// ============================================================================

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

// External Integrations
import { footyStatsRoutes } from './footystats.routes';
import { partnersRoutes } from './partners.routes';

// ============================================================================
// CENTRAL REGISTRATION FUNCTION
// ============================================================================

/**
 * Register all application routes
 *
 * Called ONCE from server.ts bootstrap.
 * All route registration logic lives here.
 *
 * @param app - Fastify instance
 */
export function registerRoutes(app: FastifyInstance): void {
  // ============================================================================
  // HEALTH & MONITORING (must be first for readiness checks)
  // ============================================================================
  app.register(healthRoutes, { prefix: '/api' });
  app.register(metricsRoutes, { prefix: '/api/metrics' });

  // ============================================================================
  // WEBSOCKET (real-time match updates)
  // ============================================================================
  app.register(websocketRoutes); // WebSocket route: /ws

  // ============================================================================
  // CORE MATCH & TEAM DATA API
  // ============================================================================
  app.register(matchRoutes, { prefix: '/api/matches' });
  app.register(seasonRoutes, { prefix: '/api/seasons' });
  app.register(teamRoutes, { prefix: '/api/teams' });
  app.register(playerRoutes, { prefix: '/api/players' });
  app.register(leagueRoutes, { prefix: '/api/leagues' });

  // ============================================================================
  // AI PREDICTIONS
  // TODO [PR-2+]: Unify prefix handling
  // - predictionRoutes: no prefix (handles own paths)
  // - predictionUnlockRoutes: /api/predictions prefix
  // ============================================================================
  app.register(predictionRoutes); // Mixed auth handled internally
  app.register(predictionUnlockRoutes, { prefix: '/api/predictions' });

  // ============================================================================
  // DASHBOARD & ANALYTICS
  // ============================================================================
  app.register(dashboardRoutes); // Mixed auth handled internally

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // Phase 2: OAuth, JWT, session management
  // ============================================================================
  app.register(authRoutes, { prefix: '/api/auth' });

  // ============================================================================
  // GAMIFICATION SYSTEMS (Phase 2-3)
  // XP, Credits, Badges, Referrals, Daily Rewards
  // ============================================================================
  app.register(xpRoutes, { prefix: '/api/xp' });
  app.register(creditsRoutes, { prefix: '/api/credits' });
  app.register(badgesRoutes, { prefix: '/api/badges' });
  app.register(referralsRoutes, { prefix: '/api/referrals' });
  app.register(dailyRewardsRoutes, { prefix: '/api/daily-rewards' });

  // ============================================================================
  // SOCIAL & COMMUNITY FEATURES (Phase 3)
  // Match comments, forum discussions, user interactions
  // ============================================================================
  app.register(commentsRoutes, { prefix: '/api/comments' });
  app.register(forumRoutes, { prefix: '/api/forum' });

  // ============================================================================
  // ADMIN & MODERATION (Phase 3)
  // Admin popup announcements, moderation tools
  // ============================================================================
  app.register(announcementsRoutes, { prefix: '/api/announcements' });

  // ============================================================================
  // EXTERNAL INTEGRATIONS (Phase 3+)
  // FootyStats AI Lab data source, Partner system
  // ============================================================================
  app.register(footyStatsRoutes, { prefix: '/api' }); // FootyStats integration
  app.register(partnersRoutes, { prefix: '/api/partners' });
}

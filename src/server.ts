/**
 * Fastify Server
 * 
 * Main application entry point - High performance for real-time match data processing
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { logger } from './utils/logger';
import { logEvent } from './utils/obsLogger';
import { sendStartupAlert } from './utils/telegramAlert';

// Central Route Registration (PR-1)
import { registerRoutes } from './routes';
// WebSocket event broadcasting (still needed for worker integration)
import { broadcastEvent, setLatencyMonitor } from './routes/websocket.routes';

import { setWebSocketState } from './controllers/health.controller';
import { pool } from './database/connection';
import { config } from './config';
import { WebSocketService } from './services/thesports/websocket/websocket.service';
import { initializeFirebase } from './config/firebase.config';
import { theSportsAPI } from './core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { unifiedPredictionService } from './services/ai/unifiedPrediction.service';
import { PredictionOrchestrator } from './services/orchestration/PredictionOrchestrator';
import type { PredictionCreatedEvent, PredictionUpdatedEvent, PredictionDeletedEvent } from './services/orchestration/predictionEvents';

// Workers - TeamData and TeamLogo use unique service patterns
import { TeamDataSyncWorker } from './jobs/teamDataSync.job';
import { TeamLogoSyncWorker } from './jobs/teamLogoSync.job';
// Entity Sync - Consolidated job for all other entity syncs
import { startEntitySyncJobs, stopEntitySyncJobs } from './jobs/entitySync.job';
// Match Workers - Critical for live match updates and minute calculation
import { MatchSyncWorker } from './jobs/matchSync.job';
import { MatchMinuteWorker } from './jobs/matchMinute.job';
// Cold Start Handler - Fixes kickoff timestamps on server restart
import { coldStartKickoffBackfill } from './jobs/coldStartKickoff.job';

dotenv.config();

const fastify = Fastify({
  logger: false,
});

// Register WebSocket
fastify.register(websocket);

// Register Helmet (Security Headers)
fastify.register(helmet, {
  contentSecurityPolicy: false,  // API server - not needed
  crossOriginEmbedderPolicy: false,
});

// Register Rate Limiting (200 req/min - Serbest config)
fastify.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${context.after}`,
  }),
});

// Register CORS (Restricted to production domain)
fastify.register(cors, {
  origin: [
    'https://partnergoalgpt.com',
    'https://www.partnergoalgpt.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Register all application routes (PR-1: Central registration)
registerRoutes(fastify);

// Initialize background workers (consolidated - most entity syncs now in entitySync.job.ts)
let teamDataSyncWorker: TeamDataSyncWorker | null = null;
let teamLogoSyncWorker: TeamLogoSyncWorker | null = null;
let websocketService: WebSocketService | null = null;
// Match workers - Critical for live updates
let matchSyncWorker: MatchSyncWorker | null = null;
let matchMinuteWorker: MatchMinuteWorker | null = null;

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const start = async () => {
  try {
    // Phase 2: Initialize Firebase Admin SDK (for OAuth verification)
    try {
      initializeFirebase();
      logger.info('✅ Firebase Admin SDK initialized');
    } catch (firebaseErr: any) {
      // Firebase is optional - only needed for OAuth authentication
      // Server will start without it, but OAuth endpoints will fail
      logger.warn('⚠️  Firebase Admin SDK initialization failed:', firebaseErr.message);
      logger.warn('    OAuth authentication will not work without Firebase credentials');
      logger.warn('    See: docs/PHASE-2-SETUP-GUIDE.md for setup instructions');
    }

    // Cold Start: Backfill missing kickoff timestamps
    // Prevents MinuteEngine errors after server restarts
    try {
      await coldStartKickoffBackfill();
    } catch (coldStartErr: any) {
      logger.warn('⚠️  Cold Start kickoff backfill failed:', coldStartErr.message);
    }

    await fastify.listen({ port: PORT, host: HOST });
    logger.info(`🚀 Fastify server running on port ${PORT}`);

    // Phase 3A: Using theSportsAPI singleton (global rate limiting enabled)
    logger.info('[Migration] Using TheSportsAPIManager singleton for all workers');

    // ============ WORKERS STARTUP ============
    logger.info('========================================');
    logger.info('🚀 Starting Background Workers...');
    logger.info('========================================');

    // Start workers (all use singleton internally)
    teamDataSyncWorker = new TeamDataSyncWorker();
    teamDataSyncWorker.start();
    logger.info('✅ TeamDataSync Worker started (interval: 6h)');

    teamLogoSyncWorker = new TeamLogoSyncWorker();
    teamLogoSyncWorker.start();
    logger.info('✅ TeamLogoSync Worker started (interval: 24h)');

    // Unified Entity Sync Jobs (Category, Country, Competition, Team, Player, etc.)
    startEntitySyncJobs();
    logger.info('✅ Entity Sync Jobs started (10 entities with scheduled cron)');

    // CRITICAL: Match Sync Worker - Handles live match updates from REST API
    matchSyncWorker = new MatchSyncWorker();
    matchSyncWorker.start();
    logger.info('✅ MatchSync Worker started (interval: 1min incremental + 3s live reconcile)');

    // CRITICAL: Match Minute Worker - Calculates minutes from kickoff timestamps
    matchMinuteWorker = new MatchMinuteWorker();
    matchMinuteWorker.start();
    logger.info('✅ MatchMinute Worker started (interval: 30s minute calculation)');

    logger.info('========================================');
    logger.info('🎉 All Background Workers Started!');
    logger.info('========================================');

    // Send Telegram startup notification (if configured)
    sendStartupAlert().catch(err => logger.debug('[TelegramAlert] Startup alert skipped:', err.message));

    // Initialize Prediction Orchestrator
    // Event-driven CRUD for AI predictions (Phase 2)
    const predictionOrchestrator = PredictionOrchestrator.getInstance();
    logger.info('✅ Prediction Orchestrator initialized');

    // Listener 1: Broadcast prediction events to WebSocket clients
    predictionOrchestrator.on('prediction:created', async (event: PredictionCreatedEvent) => {
      try {
        broadcastEvent({
          type: 'PREDICTION_CREATED',
          predictionId: event.predictionId,
          botName: event.botName,
          matchId: event.matchId || '', // Handle null matchId
          prediction: event.prediction,
          accessType: event.accessType,
          timestamp: event.timestamp,
        });
        logger.info(`[PredictionBroadcast] PREDICTION_CREATED: ${event.predictionId}`);
      } catch (error: any) {
        logger.error('[PredictionBroadcast] Error broadcasting prediction:created:', error);
      }
    });

    predictionOrchestrator.on('prediction:updated', async (event: PredictionUpdatedEvent) => {
      try {
        broadcastEvent({
          type: 'PREDICTION_UPDATED',
          matchId: event.matchId || '', // Handle null matchId
          predictionId: event.predictionId,
          fields: event.fields,
          timestamp: event.timestamp,
        });
        logger.info(`[PredictionBroadcast] PREDICTION_UPDATED: ${event.predictionId} (${event.fields.join(', ')})`);
      } catch (error: any) {
        logger.error('[PredictionBroadcast] Error broadcasting prediction:updated:', error);
      }
    });

    predictionOrchestrator.on('prediction:deleted', async (event: PredictionDeletedEvent) => {
      try {
        broadcastEvent({
          type: 'PREDICTION_DELETED',
          matchId: event.matchId || '', // Handle null matchId
          predictionId: event.predictionId,
          timestamp: event.timestamp,
        });
        logger.info(`[PredictionBroadcast] PREDICTION_DELETED: ${event.predictionId}`);
      } catch (error: any) {
        logger.error('[PredictionBroadcast] Error broadcasting prediction:deleted:', error);
      }
    });

    logger.info('✅ Prediction Orchestrator Broadcast Listeners initialized');

    // WebSocket Service
    websocketService = new WebSocketService();
    try {
      await websocketService.connect();
      setWebSocketState(true, true);

      // CRITICAL: Connect WebSocketService events to Fastify WebSocket broadcasting
      // This ensures real-time events reach frontend clients
      // Using static imports for broadcastEvent and setLatencyMonitor (imported at top)
      const { setLatencyMonitor: setMetricsLatencyMonitor } = await import('./controllers/metrics.controller');

      // LATENCY MONITORING: Share latency monitor instance
      const latencyMonitor = (websocketService as any).latencyMonitor;

      if (latencyMonitor) {
        setLatencyMonitor(latencyMonitor);
        setMetricsLatencyMonitor(latencyMonitor);
      }

      websocketService.onEvent((event: any, mqttReceivedTs?: number) => {
        broadcastEvent(event, mqttReceivedTs);

        // Auto-result predictions based on real-time events
        unifiedPredictionService.processMatchEvent(event).catch(err => {
          logger.error('Error processing match event for predictions:', err);
        });

        // CACHE INVALIDATION: Invalidate diary and live matches cache on score/state changes
        // This ensures fresh data on next request after real-time events
        if (event.type === 'GOAL' || event.type === 'SCORE_CHANGE' || event.type === 'MATCH_STATE_CHANGE') {
          try {
            const { invalidateDiaryCache, invalidateLiveMatchesCache } = require('./utils/matchCache');
            const { getTodayInTurkey } = require('./utils/dateUtils');

            // Invalidate today's diary cache (most common case)
            const today = getTodayInTurkey();
            invalidateDiaryCache(today);

            // Invalidate live matches cache
            invalidateLiveMatchesCache();
          } catch (cacheErr: any) {
            logger.warn('[Cache] Failed to invalidate cache:', cacheErr.message);
          }
        }
      });

      logger.info('✅ WebSocketService connected and event broadcasting enabled');
    } catch (e: any) {
      logger.error('WebSocket connection failed:', e.message);
      setWebSocketState(false, false);
    }

    // Phase 4: Initialize background jobs (gamification automation)
    try {
      const { initializeJobs } = await import('./jobs/jobManager');
      initializeJobs();
    } catch (jobsErr: any) {
      logger.warn('⚠️  Background jobs initialization failed:', jobsErr.message);
      logger.warn('    Phase 4 automation features will not work');
    }

    logger.info('✅ Startup complete: bootstrap OK, workers started');
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  // CRITICAL FIX: Proper shutdown sequence to prevent port conflicts and pool errors
  // 1. Stop accepting new HTTP requests first (close Fastify server)
  // 2. Stop workers (they may have pending database operations)
  // 3. Disconnect WebSocket
  // 4. Close database pool LAST (after all operations complete)
  // 5. Use timeout to force exit if graceful shutdown hangs

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout (10s) - forcing exit');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Step 1: Close Fastify (stop accepting new requests, release port immediately)
    logger.info('[Shutdown] Closing Fastify server...');
    await fastify.close();
    logger.info('[Shutdown] ✅ Fastify closed');

    // Step 2: Stop all workers (allow pending operations to complete)
    logger.info('[Shutdown] Stopping workers...');
    if (teamDataSyncWorker) teamDataSyncWorker.stop();
    if (teamLogoSyncWorker) teamLogoSyncWorker.stop();
    if (matchSyncWorker) matchSyncWorker.stop();
    if (matchMinuteWorker) matchMinuteWorker.stop();
    stopEntitySyncJobs(); // Stop all entity sync cron jobs

    // CRITICAL: Wait for in-flight operations to complete
    // Workers stopped, but their reconcile queues/pending ops may still be running
    logger.info('[Shutdown] Waiting 3s for in-flight operations to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    logger.info('[Shutdown] ✅ Workers stopped');

    // Step 3: Disconnect WebSocket
    logger.info('[Shutdown] Disconnecting WebSocket...');
    if (websocketService) await websocketService.disconnect();
    logger.info('[Shutdown] ✅ WebSocket disconnected');

    // Step 4: Close database pool LAST (after all database operations complete)
    logger.info('[Shutdown] Closing database pool...');
    await pool.end();
    logger.info('[Shutdown] ✅ Database pool closed');

    clearTimeout(shutdownTimeout);
    logger.info('[Shutdown] ✅ Graceful shutdown complete');
    process.exit(0);
  } catch (err: any) {
    clearTimeout(shutdownTimeout);
    logger.error('[Shutdown] Error during graceful shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// CRITICAL FIX: Handle uncaught exceptions and unhandled rejections
// Log the error but DO NOT exit immediately - allow graceful shutdown
process.on('uncaughtException', (err: Error) => {
  logger.error('[CRITICAL] Uncaught Exception:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });
  // Trigger graceful shutdown
  shutdown().catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('[CRITICAL] Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise,
  });
  // DO NOT exit - log and continue (most unhandled rejections are not fatal)
});

start();

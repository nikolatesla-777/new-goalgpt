/**
 * Fastify Server
 * 
 * Main application entry point - High performance for real-time match data processing
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { logger } from './utils/logger';
import { logEvent } from './utils/obsLogger';

// Routes - Corrected Imports
import matchRoutes from './routes/match.routes';
import seasonRoutes from './routes/season.routes';
import teamRoutes from './routes/team.routes';
import playerRoutes from './routes/player.routes';
import leagueRoutes from './routes/league.routes';
import { healthRoutes } from './routes/health.routes';
import { predictionRoutes } from './routes/prediction.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import websocketRoutes from './routes/websocket.routes';
import metricsRoutes from './routes/metrics.routes';

import { setWebSocketState } from './controllers/health.controller';
import { pool } from './database/connection';
import { config } from './config';
import { WebSocketService } from './services/thesports/websocket/websocket.service';
import { theSportsAPI } from './core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { MatchWatchdogWorker } from './jobs/matchWatchdog.job';
import { MatchDetailLiveService } from './services/thesports/match/matchDetailLive.service';
import { MatchRecentService } from './services/thesports/match/matchRecent.service';
import { unifiedPredictionService } from './services/ai/unifiedPrediction.service';

// Workers - Correct existing files from src/jobs
import { TeamDataSyncWorker } from './jobs/teamDataSync.job';
import { TeamLogoSyncWorker } from './jobs/teamLogoSync.job';
import { MatchSyncWorker } from './jobs/matchSync.job';
import { DailyMatchSyncWorker } from './jobs/dailyMatchSync.job';
import { LineupRefreshJob } from './jobs/lineupRefresh.job';
import { PostMatchProcessorJob } from './jobs/postMatchProcessor.job';
import { DataUpdateWorker } from './jobs/dataUpdate.job';
import { MatchMinuteWorker } from './jobs/matchMinute.job';
import { MatchDataSyncWorker } from './jobs/matchDataSync.job';
import { CompetitionSyncWorker } from './jobs/competitionSync.job';
import { PlayerSyncWorker } from './jobs/playerSync.job';

dotenv.config();

const fastify = Fastify({
  logger: false,
});

// Register WebSocket
fastify.register(websocket);

// Register CORS
fastify.register(cors, {
  origin: '*',
  credentials: true,
});


// Register routes
fastify.register(matchRoutes, { prefix: '/api/matches' });
fastify.register(seasonRoutes, { prefix: '/api/seasons' });
fastify.register(teamRoutes, { prefix: '/api/teams' });
fastify.register(playerRoutes, { prefix: '/api/players' });
fastify.register(leagueRoutes, { prefix: '/api/leagues' });
fastify.register(predictionRoutes);
fastify.register(dashboardRoutes);
fastify.register(healthRoutes, { prefix: '/api' });
fastify.register(websocketRoutes); // WebSocket route: /ws
fastify.register(metricsRoutes, { prefix: '/api/metrics' }); // Metrics routes

// Initialize background workers
let teamDataSyncWorker: TeamDataSyncWorker | null = null;
let teamLogoSyncWorker: TeamLogoSyncWorker | null = null;
let matchSyncWorker: MatchSyncWorker | null = null;
let dailyMatchSyncWorker: DailyMatchSyncWorker | null = null;
let lineupRefreshJob: LineupRefreshJob | null = null;
let postMatchProcessorJob: PostMatchProcessorJob | null = null;
let dataUpdateWorker: DataUpdateWorker | null = null;
let matchMinuteWorker: MatchMinuteWorker | null = null;
let matchWatchdogWorker: MatchWatchdogWorker | null = null;
let matchDataSyncWorker: MatchDataSyncWorker | null = null;
let competitionSyncWorker: CompetitionSyncWorker | null = null;
let playerSyncWorker: PlayerSyncWorker | null = null;
let websocketService: WebSocketService | null = null;

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    logger.info(`🚀 Fastify server running on port ${PORT}`);

    // Phase 3A: Using theSportsAPI singleton (global rate limiting enabled)
    logger.info('[Migration] Using TheSportsAPIManager singleton for all workers');

    // Start workers (all use singleton internally)
    teamDataSyncWorker = new TeamDataSyncWorker();
    teamDataSyncWorker.start();

    teamLogoSyncWorker = new TeamLogoSyncWorker();
    teamLogoSyncWorker.start();

    matchSyncWorker = new MatchSyncWorker();
    matchSyncWorker.start();

    dailyMatchSyncWorker = new DailyMatchSyncWorker();
    dailyMatchSyncWorker.start();

    lineupRefreshJob = new LineupRefreshJob();
    lineupRefreshJob.start();

    postMatchProcessorJob = new PostMatchProcessorJob();
    postMatchProcessorJob.start();

    dataUpdateWorker = new DataUpdateWorker();
    dataUpdateWorker.start();

    matchMinuteWorker = new MatchMinuteWorker();
    matchMinuteWorker.start();

    // Match Data Sync Worker (automatically saves statistics, incidents, trend for live matches)
    matchDataSyncWorker = new MatchDataSyncWorker();
    matchDataSyncWorker.start();

    // Match Watchdog Worker (for should-be-live matches)
    const matchDetailLiveService = new MatchDetailLiveService();
    const matchRecentService = new MatchRecentService();
    matchWatchdogWorker = new MatchWatchdogWorker(matchDetailLiveService, matchRecentService);
    matchWatchdogWorker.start();

    // Competition Sync Worker (syncs competition/league data)
    competitionSyncWorker = new CompetitionSyncWorker();
    competitionSyncWorker.start();
    logger.info('✅ Competition Sync Worker started');

    // Player Sync Worker (syncs player data)
    playerSyncWorker = new PlayerSyncWorker();
    playerSyncWorker.start();
    logger.info('✅ Player Sync Worker started');

    // WebSocket Service
    websocketService = new WebSocketService();
    try {
      await websocketService.connect();
      setWebSocketState(true, true);

      // CRITICAL: Connect WebSocketService events to Fastify WebSocket broadcasting
      // This ensures real-time events reach frontend clients
      const { broadcastEvent, setLatencyMonitor } = await import('./routes/websocket.routes');
      const { setLatencyMonitor: setMetricsLatencyMonitor, setWriteQueue } = await import('./controllers/metrics.controller');

      // LATENCY MONITORING: Share latency monitor instance
      const latencyMonitor = (websocketService as any).latencyMonitor;
      const writeQueue = (websocketService as any).writeQueue;

      if (latencyMonitor) {
        setLatencyMonitor(latencyMonitor);
        setMetricsLatencyMonitor(latencyMonitor);
      }

      if (writeQueue) {
        setWriteQueue(writeQueue);
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
    if (dailyMatchSyncWorker) dailyMatchSyncWorker.stop();
    if (lineupRefreshJob) lineupRefreshJob.stop();
    if (postMatchProcessorJob) postMatchProcessorJob.stop();
    if (dataUpdateWorker) dataUpdateWorker.stop();
    if (matchMinuteWorker) matchMinuteWorker.stop();
    if (matchDataSyncWorker) matchDataSyncWorker.stop();
    if (matchWatchdogWorker) matchWatchdogWorker.stop();
    if (competitionSyncWorker) competitionSyncWorker.stop();
    if (playerSyncWorker) playerSyncWorker.stop();

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

/**
 * Fastify Server
 * 
 * Main application entry point - High performance for real-time match data processing
 * With Socket.IO integration for real-time frontend updates
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import matchRoutes from './routes/match.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import seasonRoutes from './routes/season.routes';
import { teamRoutes } from './routes/team.routes';
import { leagueRoutes } from './routes/league.routes';
import { predictionRoutes } from './routes/prediction.routes';
import { config } from './config';
import { WebSocketService } from './services/thesports/websocket/websocket.service';
import { TheSportsClient } from './services/thesports/client/thesports-client';
import { TeamDataSyncWorker } from './jobs/teamDataSync.job';
import { TeamLogoSyncWorker } from './jobs/teamLogoSync.job';
import { MatchSyncWorker } from './jobs/matchSync.job';
import { DailyMatchSyncWorker } from './jobs/dailyMatchSync.job';
import { MatchLifecycleJob } from './jobs/matchLifecycle.job';
import { LiveStatusSyncJob } from './jobs/liveStatusSync.job';
import { socketIOService } from './services/socket/socketio.service';
import { liveDataCoordinator } from './services/thesports/websocket/livedata.coordinator';

dotenv.config();

const fastify = Fastify({
  logger: false, // We use winston for logging
});

// Register CORS
fastify.register(cors, {
  origin: '*',
  credentials: true,
});

// Health check
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
});

// Register routes
fastify.register(matchRoutes, { prefix: '/api/matches' });
fastify.register(dashboardRoutes);
fastify.register(seasonRoutes, { prefix: '/api/seasons' });
fastify.register(teamRoutes, { prefix: '/api/teams' });
fastify.register(leagueRoutes, { prefix: '/api/leagues' });
fastify.register(predictionRoutes);

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Error:', error);
  reply.status(500).send({
    success: false,
    message: error.message || 'Internal server error',
  });
});

// Initialize background workers
let teamDataSyncWorker: TeamDataSyncWorker | null = null;
let teamLogoSyncWorker: TeamLogoSyncWorker | null = null;
let matchSyncWorker: MatchSyncWorker | null = null;
let dailyMatchSyncWorker: DailyMatchSyncWorker | null = null;
let matchLifecycleJob: MatchLifecycleJob | null = null;
let liveStatusSyncJob: LiveStatusSyncJob | null = null;
let websocketService: WebSocketService | null = null;

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    logger.info(`🚀 Fastify server running on port ${PORT}`);
    logger.info(`📊 API: http://localhost:${PORT}/api`);

    // Initialize Socket.IO with Fastify's HTTP server
    const httpServer = fastify.server;
    socketIOService.initialize(httpServer);
    logger.info('✅ Socket.IO service initialized');

    // Start background workers
    const theSportsClient = new TheSportsClient();

    teamDataSyncWorker = new TeamDataSyncWorker(theSportsClient);
    teamDataSyncWorker.start();

    teamLogoSyncWorker = new TeamLogoSyncWorker(theSportsClient);
    teamLogoSyncWorker.start();

    matchSyncWorker = new MatchSyncWorker(theSportsClient);
    matchSyncWorker.start();

    dailyMatchSyncWorker = new DailyMatchSyncWorker(theSportsClient);
    dailyMatchSyncWorker.start();

    matchLifecycleJob = new MatchLifecycleJob(theSportsClient);
    matchLifecycleJob.start();

    // CRITICAL: LiveStatusSyncJob - polls /match/detail_live every 5 seconds
    // This is the fix for delayed match status updates (was 5+ minutes, now 5 seconds)
    liveStatusSyncJob = new LiveStatusSyncJob(theSportsClient);
    liveStatusSyncJob.start();

    // Initialize WebSocket service (TheSports API connection)
    websocketService = new WebSocketService();

    // Register event handlers - Push to frontend via Socket.IO
    websocketService.onEvent((event) => {
      logger.info(`⚡ WebSocket Event: ${event.type} for match ${event.matchId}`);

      // Push event to frontend via Socket.IO
      socketIOService.pushMatchEvent(event);

      // Update coordinator state
      if (event.type === 'GOAL') {
        const goalEvent = event as any;
        liveDataCoordinator.processWebSocketUpdate(
          event.matchId,
          goalEvent.homeScore,
          goalEvent.awayScore,
          0, // status will be updated from full message
          `${goalEvent.time}'`
        );
      }
    });

    // Connect to TheSports WebSocket
    try {
      await websocketService.connect();
      liveDataCoordinator.setWebSocketActive(true);
      logger.info('✅ TheSports WebSocket connected');
    } catch (error: any) {
      logger.error('⚠️ WebSocket connection failed, will retry:', error.message);
      liveDataCoordinator.setWebSocketActive(false);
      // Continue without WebSocket, fallback to HTTP polling
    }

    logger.info('✅ All services started');
    logger.info(`🔌 Socket.IO available at ws://localhost:${PORT}/socket.io`);
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  if (teamDataSyncWorker) teamDataSyncWorker.stop();
  if (teamLogoSyncWorker) teamLogoSyncWorker.stop();
  if (matchSyncWorker) matchSyncWorker.stop();
  if (dailyMatchSyncWorker) dailyMatchSyncWorker.stop();
  if (matchLifecycleJob) matchLifecycleJob.stop();
  if (websocketService) websocketService.disconnect();

  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();


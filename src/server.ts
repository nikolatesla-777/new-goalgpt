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
import healthRoutes from './routes/health.routes';
import { predictionRoutes } from './routes/prediction.routes';
import { dashboardRoutes } from './routes/dashboard.routes';

import { setWebSocketState } from './controllers/health.controller';
import { pool } from './database/connection';
import { config } from './config';
import { WebSocketService } from './services/thesports/websocket/websocket.service';
import { TheSportsClient } from './services/thesports/client/thesports-client';

// Workers - Correct existing files from src/jobs
import { TeamDataSyncWorker } from './jobs/teamDataSync.job';
import { TeamLogoSyncWorker } from './jobs/teamLogoSync.job';
import { MatchSyncWorker } from './jobs/matchSync.job';
import { DailyMatchSyncWorker } from './jobs/dailyMatchSync.job';
import { LineupRefreshJob } from './jobs/lineupRefresh.job';
import { PostMatchProcessorJob } from './jobs/postMatchProcessor.job';
import { DataUpdateWorker } from './jobs/dataUpdate.job';
import { MatchMinuteWorker } from './jobs/matchMinute.job';

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

// Health check - Basic check for uptime
fastify.get('/api/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
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

// Initialize background workers
let teamDataSyncWorker: TeamDataSyncWorker | null = null;
let teamLogoSyncWorker: TeamLogoSyncWorker | null = null;
let matchSyncWorker: MatchSyncWorker | null = null;
let dailyMatchSyncWorker: DailyMatchSyncWorker | null = null;
let lineupRefreshJob: LineupRefreshJob | null = null;
let postMatchProcessorJob: PostMatchProcessorJob | null = null;
let dataUpdateWorker: DataUpdateWorker | null = null;
let matchMinuteWorker: MatchMinuteWorker | null = null;
let websocketService: WebSocketService | null = null;

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    logger.info(`🚀 Fastify server running on port ${PORT}`);

    const theSportsClient = new TheSportsClient();

    // Start workers
    teamDataSyncWorker = new TeamDataSyncWorker(theSportsClient);
    teamDataSyncWorker.start();

    teamLogoSyncWorker = new TeamLogoSyncWorker(theSportsClient);
    teamLogoSyncWorker.start();

    matchSyncWorker = new MatchSyncWorker(theSportsClient);
    matchSyncWorker.start();

    dailyMatchSyncWorker = new DailyMatchSyncWorker(theSportsClient);
    dailyMatchSyncWorker.start();

    lineupRefreshJob = new LineupRefreshJob(theSportsClient);
    lineupRefreshJob.start();

    postMatchProcessorJob = new PostMatchProcessorJob(theSportsClient);
    postMatchProcessorJob.start();

    dataUpdateWorker = new DataUpdateWorker();
    dataUpdateWorker.start();

    matchMinuteWorker = new MatchMinuteWorker();
    matchMinuteWorker.start();

    // WebSocket Service
    websocketService = new WebSocketService();
    try {
      await websocketService.connect();
      setWebSocketState(true, true);
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

  if (teamDataSyncWorker) teamDataSyncWorker.stop();
  if (teamLogoSyncWorker) teamLogoSyncWorker.stop();
  if (matchSyncWorker) matchSyncWorker.stop();
  if (dailyMatchSyncWorker) dailyMatchSyncWorker.stop();
  if (lineupRefreshJob) lineupRefreshJob.stop();
  if (postMatchProcessorJob) postMatchProcessorJob.stop();
  if (dataUpdateWorker) dataUpdateWorker.stop();
  if (matchMinuteWorker) matchMinuteWorker.stop();

  if (websocketService) await websocketService.disconnect();

  await pool.end();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

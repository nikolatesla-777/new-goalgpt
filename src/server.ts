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
import matchRoutes from './routes/match.routes';
import healthRoutes from './routes/health.routes';
import { setWebSocketState } from './controllers/health.controller';
import { pool } from './database/connection';
import { config } from './config';
import { WebSocketService } from './services/thesports/websocket/websocket.service';
import { TheSportsClient } from './services/thesports/client/thesports-client';
import { TeamDataSyncWorker } from './jobs/teamDataSync.job';
import { TeamLogoSyncWorker } from './jobs/teamLogoSync.job';
import { MatchSyncWorker } from './jobs/matchSync.job';
import { DailyMatchSyncWorker } from './jobs/dailyMatchSync.job';
import { CompetitionSyncWorker } from './jobs/competitionSync.job';
import { CategorySyncWorker } from './jobs/categorySync.job';
import { CountrySyncWorker } from './jobs/countrySync.job';
import { TeamSyncWorker } from './jobs/teamSync.job';
import { PlayerSyncWorker } from './jobs/playerSync.job';
import { CoachSyncWorker } from './jobs/coachSync.job';
import { RefereeSyncWorker } from './jobs/refereeSync.job';
import { VenueSyncWorker } from './jobs/venueSync.job';
import { SeasonSyncWorker } from './jobs/seasonSync.job';
import { StageSyncWorker } from './jobs/stageSync.job';
import { DataUpdateWorker } from './jobs/dataUpdate.job';
import { MatchMinuteWorker } from './jobs/matchMinute.job';
import { MatchWatchdogWorker } from './jobs/matchWatchdog.job';
import { MatchFreezeDetectionWorker } from './jobs/matchFreezeDetection.job';
import { MatchDetailLiveService } from './services/thesports/match/matchDetailLive.service';
import { MatchRecentService } from './services/thesports/match/matchRecent.service';
import { BootstrapService } from './services/bootstrap.service';

dotenv.config();

// Phase 4-5 WS3: Startup config validation (fail-fast)
// Validate required environment variables before server starts
const REQUIRED_ANY_OF: Record<string, string[]> = {
  THESPORTS_API_SECRET: ['THESPORTS_API_SECRET'],
  THESPORTS_API_USER: ['THESPORTS_API_USER'],
  DB_HOST: ['DB_HOST'],
  DB_PORT: ['DB_PORT'],
  DB_NAME: ['DB_NAME'],
  DB_USER: ['DB_USER'],
  DB_PASSWORD: ['DB_PASSWORD', 'DB_PASS', 'POSTGRES_PASSWORD'],
};

const missing: string[] = [];
for (const [logicalName, envKeys] of Object.entries(REQUIRED_ANY_OF)) {
  const ok = envKeys.some((k) => (process.env[k] ?? '').trim() !== '');
  if (!ok) missing.push(`${logicalName} (any of: ${envKeys.join(', ')})`);
}

if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join('; ')}`);
  process.exit(1);
}

const fastify = Fastify({
  logger: false, // We use winston for logging
});

// Phase 4-5 WS3: CORS with allowlist (fix wildcard + credentials bug)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow non-browser tools / same-origin (no origin header)
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
});

// Phase 4-5 WS3: HTTP-level rate limiting
// Note: Rate limiting requires @fastify/rate-limit package installation
// For production deployment: npm install @fastify/rate-limit@^9.0.0
// Currently optional (backward compatibility) - uncomment when package is installed:
/*
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '120', 10);
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
try {
  const rateLimit = await import('@fastify/rate-limit');
  await fastify.register(rateLimit.default, {
    max: rateLimitMax,
    timeWindow: rateLimitWindow,
    continueExceeding: false,
  });
} catch (error) {
  logger.warn('Rate limiting not available (package not installed)');
}
*/

// Register WebSocket for real-time updates to frontend
fastify.register(websocket);

// WebSocket connections from frontend (for real-time push notifications)
const frontendConnections = new Set<any>();

// Phase 4-5 WS3: Request correlation IDs (onRequest hook)
fastify.addHook('onRequest', async (request, reply) => {
  // Read x-request-id if present; else generate UUID
  const requestId = (request.headers['x-request-id'] as string) || randomUUID();
  (request as any).requestId = requestId; // Attach to request for logging
  reply.header('X-Request-Id', requestId);
});

// WebSocket endpoint for frontend (defined BEFORE startServer)
fastify.get('/ws', { websocket: true }, (connection, req) => {
  frontendConnections.add(connection);
  logger.info(`Frontend WebSocket connected. Total connections: ${frontendConnections.size}`);
  
  connection.socket.on('close', () => {
    frontendConnections.delete(connection);
    logger.info(`Frontend WebSocket disconnected. Total connections: ${frontendConnections.size}`);
  });
});

// Phase 4-5 WS3: Security headers (CSP already present, add standard headers)
fastify.addHook('onSend', async (request, reply) => {
  // Existing CSP header
  reply.header('Content-Security-Policy', "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; object-src 'none';");
  
  // Standard security headers
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-XSS-Protection', '1; mode=block');
  
  // HSTS only if HTTPS (or behind proxy with forwarded proto)
  const isHttps = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Root route
fastify.get('/', async (request, reply) => {
  return {
    message: 'GoalGPT API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      matches: {
        recent: '/api/matches/recent',
        diary: '/api/matches/diary',
        seasonRecent: '/api/matches/season/recent',
        detailLive: '/api/matches/:match_id/detail-live',
        lineup: '/api/matches/:match_id/lineup',
        teamStats: '/api/matches/:match_id/team-stats',
        playerStats: '/api/matches/:match_id/player-stats',
      },
    },
    timestamp: new Date().toISOString(),
  };
});

// Register routes
fastify.register(matchRoutes, { prefix: '/api/matches' });
fastify.register(healthRoutes); // Health and readiness endpoints

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
let competitionSyncWorker: CompetitionSyncWorker | null = null;
let categorySyncWorker: CategorySyncWorker | null = null;
let countrySyncWorker: CountrySyncWorker | null = null;
let teamSyncWorker: TeamSyncWorker | null = null;
let playerSyncWorker: PlayerSyncWorker | null = null;
let coachSyncWorker: CoachSyncWorker | null = null;
let refereeSyncWorker: RefereeSyncWorker | null = null;
let venueSyncWorker: VenueSyncWorker | null = null;
let seasonSyncWorker: SeasonSyncWorker | null = null;
let stageSyncWorker: StageSyncWorker | null = null;
let dataUpdateWorker: DataUpdateWorker | null = null;
let matchMinuteWorker: MatchMinuteWorker | null = null;
let matchWatchdogWorker: MatchWatchdogWorker | null = null;
let matchFreezeDetectionWorker: MatchFreezeDetectionWorker | null = null;
let websocketService: WebSocketService | null = null;
let isShuttingDown = false;

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    logger.info(`🚀 Fastify server running on port ${PORT}`);
    logger.info(`📊 API: http://localhost:${PORT}/api`);

    // Phase 4-5 WS4: Structured logging for server start
    logEvent('info', 'server.listening', { port: PORT, host: HOST });

    const theSportsClient = new TheSportsClient();
    
    // CRITICAL: Bootstrap system before starting MQTT
    // Bootstrap MUST complete successfully before MQTT connection
    logger.info('🔧 Running Bootstrap Sequence...');
    let bootstrapSuccess = false;
    try {
      const bootstrapper = new BootstrapService();
      await bootstrapper.init();
      logger.info('✅ Bootstrap Complete');
      bootstrapSuccess = true;
    } catch (error: any) {
      logger.error('❌ Bootstrap failed:', error.message);
      logger.error('⚠️ MQTT connection will NOT start without successful bootstrap');
      // Do NOT continue - system needs bootstrap to be ready
      throw new Error(`Bootstrap failed: ${error.message}`);
    }

    // Initialize WebSocket service (ONLY after bootstrap completes successfully)
    if (!bootstrapSuccess) {
      logger.error('❌ Cannot start MQTT: Bootstrap did not complete successfully');
      throw new Error('Bootstrap did not complete successfully');
    }

    websocketService = new WebSocketService();
    
    // Register event handlers - push to frontend when goal/score changes
    websocketService.onEvent((event) => {
      logger.info(`WebSocket Event: ${event.type} for match ${event.matchId}`);
      
      // CRITICAL: Push event to all connected frontend clients
      const message = JSON.stringify({
        type: event.type,
        matchId: event.matchId,
        data: event,
        timestamp: Date.now(),
      });
      
      frontendConnections.forEach((conn) => {
        try {
          conn.socket.send(message);
        } catch (error: any) {
          logger.error('Failed to send WebSocket message to frontend:', error);
          frontendConnections.delete(conn);
        }
      });
    });
    
    // CRITICAL: Also push score updates directly when MQTT receives score messages
    // We'll hook into the WebSocketService to emit SCORE_CHANGE events
    // This is handled by the existing onEvent handler above

    // Connect WebSocket (only after bootstrap completes successfully)
    try {
      await websocketService.connect();
      logger.info('✅ WebSocket service connected');
      setWebSocketState(true, true); // enabled and connected
    } catch (error: any) {
      logger.error('⚠️ WebSocket connection failed, will retry:', error.message);
      setWebSocketState(true, false); // enabled but not connected
      // Continue without WebSocket, fallback to HTTP polling
    }

    // Start background workers
    teamDataSyncWorker = new TeamDataSyncWorker(theSportsClient);
    teamDataSyncWorker.start();

    teamLogoSyncWorker = new TeamLogoSyncWorker(theSportsClient);
    teamLogoSyncWorker.start();

    matchSyncWorker = new MatchSyncWorker(theSportsClient);
    matchSyncWorker.start();

    dailyMatchSyncWorker = new DailyMatchSyncWorker(theSportsClient);
    dailyMatchSyncWorker.start();

    competitionSyncWorker = new CompetitionSyncWorker();
    competitionSyncWorker.start();

    categorySyncWorker = new CategorySyncWorker();
    categorySyncWorker.start();

    countrySyncWorker = new CountrySyncWorker();
    countrySyncWorker.start();

    teamSyncWorker = new TeamSyncWorker();
    teamSyncWorker.start();

    playerSyncWorker = new PlayerSyncWorker();
    playerSyncWorker.start(); // Note: Does NOT auto-sync on startup (high volume)

    coachSyncWorker = new CoachSyncWorker();
    coachSyncWorker.start();

    refereeSyncWorker = new RefereeSyncWorker();
    refereeSyncWorker.start();

    venueSyncWorker = new VenueSyncWorker();
    venueSyncWorker.start();

    seasonSyncWorker = new SeasonSyncWorker();
    seasonSyncWorker.start();

    stageSyncWorker = new StageSyncWorker();
    stageSyncWorker.start();

    dataUpdateWorker = new DataUpdateWorker();
    dataUpdateWorker.start();

    // MatchWatchdogWorker needs MatchDetailLiveService and MatchRecentService
    // Phase 5-S FIX: Added MatchRecentService for /match/recent/list reconciliation
    const matchDetailLiveService = new MatchDetailLiveService(theSportsClient);
    const matchRecentService = new MatchRecentService(theSportsClient);
    matchWatchdogWorker = new MatchWatchdogWorker(matchDetailLiveService, matchRecentService);
    matchWatchdogWorker.start();

    // CRITICAL FIX: Proactive Match Status Check Worker
    // Normal akış çalışmadığı için (WebSocket/data_update/recent_list) proaktif kontrol
    // Bugünkü maçları periyodik olarak kontrol eder ve status günceller
    const { ProactiveMatchStatusCheckWorker } = await import('./jobs/proactiveMatchStatusCheck.job');
    const proactiveCheckWorker = new ProactiveMatchStatusCheckWorker(matchDetailLiveService);
    proactiveCheckWorker.start();

    // Phase 4-3: Match Freeze Detection Worker
    matchFreezeDetectionWorker = new MatchFreezeDetectionWorker(matchDetailLiveService);
    matchFreezeDetectionWorker.start();

    matchMinuteWorker = new MatchMinuteWorker();
    matchMinuteWorker.start();

    logger.info('✅ Startup complete: bootstrap OK, websocket connected (or fallback), workers started');
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal?: string) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal ?? 'signal'}`);
    return;
  }
  isShuttingDown = true;

  // Phase 4-5 WS4: Structured logging for shutdown
  logEvent('info', 'shutdown.start', { signal: signal || 'unknown' });
  logger.info(`Shutting down gracefully... ${signal ? `(signal=${signal})` : ''}`);

  try {
    // Stop background workers (best-effort; do not throw)
    try { teamDataSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop TeamDataSyncWorker:', e); }
    try { teamLogoSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop TeamLogoSyncWorker:', e); }
    try { matchSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop MatchSyncWorker:', e); }
    try { dailyMatchSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop DailyMatchSyncWorker:', e); }

    try { competitionSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop CompetitionSyncWorker:', e); }
    try { categorySyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop CategorySyncWorker:', e); }
    try { countrySyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop CountrySyncWorker:', e); }
    try { teamSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop TeamSyncWorker:', e); }
    try { playerSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop PlayerSyncWorker:', e); }
    try { coachSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop CoachSyncWorker:', e); }
    try { refereeSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop RefereeSyncWorker:', e); }
    try { venueSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop VenueSyncWorker:', e); }
    try { seasonSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop SeasonSyncWorker:', e); }
    try { stageSyncWorker?.stop(); } catch (e: any) { logger.error('Failed to stop StageSyncWorker:', e); }
    try { dataUpdateWorker?.stop(); } catch (e: any) { logger.error('Failed to stop DataUpdateWorker:', e); }
    try { matchWatchdogWorker?.stop(); } catch (e: any) { logger.error('Failed to stop MatchWatchdogWorker:', e); }
    try { matchFreezeDetectionWorker?.stop(); } catch (e: any) { logger.error('Failed to stop MatchFreezeDetectionWorker:', e); }
    try { matchMinuteWorker?.stop(); } catch (e: any) { logger.error('Failed to stop MatchMinuteWorker:', e); }

    // Disconnect MQTT/WebSocket service
    try {
      if (websocketService) {
        await Promise.resolve(websocketService.disconnect() as any);
        setWebSocketState(false, false); // Update health state
      }
    } catch (e: any) {
      logger.error('Failed to disconnect WebSocketService:', e);
    }

    // Phase 4-5 WS4: Close DB pool
    try {
      await pool.end();
      logger.info('✅ Database pool closed');
    } catch (e: any) {
      logger.error('Failed to close database pool:', e);
    }

    // Close HTTP server
    try {
  await fastify.close();
      logger.info('✅ HTTP server closed');
    } catch (e: any) {
      logger.error('Failed to close Fastify server:', e);
    }

    // Phase 4-5 WS4: Structured logging for shutdown completion
    logEvent('info', 'shutdown.done', { signal: signal || 'unknown' });
    logger.info('✅ Shutdown complete');
    
    // Ensure logs are flushed before exit (Winston file transport may be async)
    // Winston logger.end() ensures all transports finish writing
    await new Promise<void>((resolve) => {
      logger.end(() => {
        resolve();
      });
    });
    
  process.exit(0);
  } catch (err: any) {
    logger.error('❌ Shutdown error:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

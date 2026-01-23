"use strict";
/**
 * Fastify Server
 *
 * Main application entry point - High performance for real-time match data processing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// CRITICAL: Load environment variables BEFORE any imports
// This ensures JWT_SECRET and other env vars are available during module initialization
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const logger_1 = require("./utils/logger");
const telegramAlert_1 = require("./utils/telegramAlert");
// Central Route Registration (PR-1)
const routes_1 = require("./routes");
// WebSocket event broadcasting (still needed for worker integration)
const websocket_routes_1 = require("./routes/websocket.routes");
const health_controller_1 = require("./controllers/health.controller");
const connection_1 = require("./database/connection");
const websocket_service_1 = require("./services/thesports/websocket/websocket.service");
const firebase_config_1 = require("./config/firebase.config");
const unifiedPrediction_service_1 = require("./services/ai/unifiedPrediction.service");
const PredictionOrchestrator_1 = require("./services/orchestration/PredictionOrchestrator");
// Workers - TeamData and TeamLogo use unique service patterns
const teamDataSync_job_1 = require("./jobs/teamDataSync.job");
const teamLogoSync_job_1 = require("./jobs/teamLogoSync.job");
// Entity Sync - Consolidated job for all other entity syncs
const entitySync_job_1 = require("./jobs/entitySync.job");
// Match Workers - Critical for live match updates and minute calculation
const matchSync_job_1 = require("./jobs/matchSync.job");
const matchMinute_job_1 = require("./jobs/matchMinute.job");
// Cold Start Handler - Fixes kickoff timestamps on server restart
const coldStartKickoff_job_1 = require("./jobs/coldStartKickoff.job");
const fastify = (0, fastify_1.default)({
    logger: false,
});
// Register WebSocket
fastify.register(websocket_1.default);
// Register Helmet (Security Headers)
fastify.register(helmet_1.default, {
    contentSecurityPolicy: false, // API server - not needed
    crossOriginEmbedderPolicy: false,
});
// Register Rate Limiting (200 req/min - Serbest config)
fastify.register(rate_limit_1.default, {
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
fastify.register(cors_1.default, {
    origin: [
        'https://partnergoalgpt.com',
        'https://www.partnergoalgpt.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});
// Initialize background workers (consolidated - most entity syncs now in entitySync.job.ts)
let teamDataSyncWorker = null;
let teamLogoSyncWorker = null;
let websocketService = null;
// Match workers - Critical for live updates
let matchSyncWorker = null;
let matchMinuteWorker = null;
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const start = async () => {
    try {
        // Register all application routes (PR-2: Auth grouping with hooks)
        await (0, routes_1.registerRoutes)(fastify);
        // Phase 2: Initialize Firebase Admin SDK (for OAuth verification)
        try {
            (0, firebase_config_1.initializeFirebase)();
            logger_1.logger.info('✅ Firebase Admin SDK initialized');
        }
        catch (firebaseErr) {
            // Firebase is optional - only needed for OAuth authentication
            // Server will start without it, but OAuth endpoints will fail
            logger_1.logger.warn('⚠️  Firebase Admin SDK initialization failed:', firebaseErr.message);
            logger_1.logger.warn('    OAuth authentication will not work without Firebase credentials');
            logger_1.logger.warn('    See: docs/PHASE-2-SETUP-GUIDE.md for setup instructions');
        }
        // Cold Start: Backfill missing kickoff timestamps
        // Prevents MinuteEngine errors after server restarts
        try {
            await (0, coldStartKickoff_job_1.coldStartKickoffBackfill)();
        }
        catch (coldStartErr) {
            logger_1.logger.warn('⚠️  Cold Start kickoff backfill failed:', coldStartErr.message);
        }
        await fastify.listen({ port: PORT, host: HOST });
        logger_1.logger.info(`🚀 Fastify server running on port ${PORT}`);
        // Phase 3A: Using theSportsAPI singleton (global rate limiting enabled)
        logger_1.logger.info('[Migration] Using TheSportsAPIManager singleton for all workers');
        // ============ WORKERS STARTUP ============
        logger_1.logger.info('========================================');
        logger_1.logger.info('🚀 Starting Background Workers...');
        logger_1.logger.info('========================================');
        // Start workers (all use singleton internally)
        teamDataSyncWorker = new teamDataSync_job_1.TeamDataSyncWorker();
        teamDataSyncWorker.start();
        logger_1.logger.info('✅ TeamDataSync Worker started (interval: 6h)');
        teamLogoSyncWorker = new teamLogoSync_job_1.TeamLogoSyncWorker();
        teamLogoSyncWorker.start();
        logger_1.logger.info('✅ TeamLogoSync Worker started (interval: 24h)');
        // Unified Entity Sync Jobs (Category, Country, Competition, Team, Player, etc.)
        (0, entitySync_job_1.startEntitySyncJobs)();
        logger_1.logger.info('✅ Entity Sync Jobs started (10 entities with scheduled cron)');
        // CRITICAL: Match Sync Worker - Handles live match updates from REST API
        matchSyncWorker = new matchSync_job_1.MatchSyncWorker();
        matchSyncWorker.start();
        logger_1.logger.info('✅ MatchSync Worker started (interval: 1min incremental + 3s live reconcile)');
        // CRITICAL: Match Minute Worker - Calculates minutes from kickoff timestamps
        matchMinuteWorker = new matchMinute_job_1.MatchMinuteWorker();
        matchMinuteWorker.start();
        logger_1.logger.info('✅ MatchMinute Worker started (interval: 30s minute calculation)');
        logger_1.logger.info('========================================');
        logger_1.logger.info('🎉 All Background Workers Started!');
        logger_1.logger.info('========================================');
        // Send Telegram startup notification (if configured)
        (0, telegramAlert_1.sendStartupAlert)().catch(err => logger_1.logger.debug('[TelegramAlert] Startup alert skipped:', err.message));
        // Initialize Prediction Orchestrator
        // Event-driven CRUD for AI predictions (Phase 2)
        const predictionOrchestrator = PredictionOrchestrator_1.PredictionOrchestrator.getInstance();
        logger_1.logger.info('✅ Prediction Orchestrator initialized');
        // Listener 1: Broadcast prediction events to WebSocket clients
        predictionOrchestrator.on('prediction:created', async (event) => {
            try {
                (0, websocket_routes_1.broadcastEvent)({
                    type: 'PREDICTION_CREATED',
                    predictionId: event.predictionId,
                    botName: event.botName,
                    matchId: event.matchId || '', // Handle null matchId
                    prediction: event.prediction,
                    accessType: event.accessType,
                    timestamp: event.timestamp,
                });
                logger_1.logger.info(`[PredictionBroadcast] PREDICTION_CREATED: ${event.predictionId}`);
            }
            catch (error) {
                logger_1.logger.error('[PredictionBroadcast] Error broadcasting prediction:created:', error);
            }
        });
        predictionOrchestrator.on('prediction:updated', async (event) => {
            try {
                (0, websocket_routes_1.broadcastEvent)({
                    type: 'PREDICTION_UPDATED',
                    matchId: event.matchId || '', // Handle null matchId
                    predictionId: event.predictionId,
                    fields: event.fields,
                    timestamp: event.timestamp,
                });
                logger_1.logger.info(`[PredictionBroadcast] PREDICTION_UPDATED: ${event.predictionId} (${event.fields.join(', ')})`);
            }
            catch (error) {
                logger_1.logger.error('[PredictionBroadcast] Error broadcasting prediction:updated:', error);
            }
        });
        predictionOrchestrator.on('prediction:deleted', async (event) => {
            try {
                (0, websocket_routes_1.broadcastEvent)({
                    type: 'PREDICTION_DELETED',
                    matchId: event.matchId || '', // Handle null matchId
                    predictionId: event.predictionId,
                    timestamp: event.timestamp,
                });
                logger_1.logger.info(`[PredictionBroadcast] PREDICTION_DELETED: ${event.predictionId}`);
            }
            catch (error) {
                logger_1.logger.error('[PredictionBroadcast] Error broadcasting prediction:deleted:', error);
            }
        });
        logger_1.logger.info('✅ Prediction Orchestrator Broadcast Listeners initialized');
        // WebSocket Service
        websocketService = new websocket_service_1.WebSocketService();
        try {
            await websocketService.connect();
            (0, health_controller_1.setWebSocketState)(true, true);
            // CRITICAL: Connect WebSocketService events to Fastify WebSocket broadcasting
            // This ensures real-time events reach frontend clients
            // Using static imports for broadcastEvent and setLatencyMonitor (imported at top)
            const { setLatencyMonitor: setMetricsLatencyMonitor } = await Promise.resolve().then(() => __importStar(require('./controllers/metrics.controller')));
            // LATENCY MONITORING: Share latency monitor instance
            const latencyMonitor = websocketService.latencyMonitor;
            if (latencyMonitor) {
                (0, websocket_routes_1.setLatencyMonitor)(latencyMonitor);
                setMetricsLatencyMonitor(latencyMonitor);
            }
            websocketService.onEvent((event, mqttReceivedTs) => {
                (0, websocket_routes_1.broadcastEvent)(event, mqttReceivedTs);
                // Auto-result predictions based on real-time events
                unifiedPrediction_service_1.unifiedPredictionService.processMatchEvent(event).catch(err => {
                    logger_1.logger.error('Error processing match event for predictions:', err);
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
                    }
                    catch (cacheErr) {
                        logger_1.logger.warn('[Cache] Failed to invalidate cache:', cacheErr.message);
                    }
                }
            });
            logger_1.logger.info('✅ WebSocketService connected and event broadcasting enabled');
        }
        catch (e) {
            logger_1.logger.error('WebSocket connection failed:', e.message);
            (0, health_controller_1.setWebSocketState)(false, false);
        }
        // Phase 4: Initialize background jobs (gamification automation)
        try {
            const { initializeJobs } = await Promise.resolve().then(() => __importStar(require('./jobs/jobManager')));
            initializeJobs();
        }
        catch (jobsErr) {
            logger_1.logger.warn('⚠️  Background jobs initialization failed:', jobsErr.message);
            logger_1.logger.warn('    Phase 4 automation features will not work');
        }
        logger_1.logger.info('✅ Startup complete: bootstrap OK, workers started');
    }
    catch (err) {
        logger_1.logger.error('Error starting server:', err);
        process.exit(1);
    }
};
const shutdown = async () => {
    logger_1.logger.info('Shutting down gracefully...');
    // CRITICAL FIX: Proper shutdown sequence to prevent port conflicts and pool errors
    // 1. Stop accepting new HTTP requests first (close Fastify server)
    // 2. Stop workers (they may have pending database operations)
    // 3. Disconnect WebSocket
    // 4. Close database pool LAST (after all operations complete)
    // 5. Use timeout to force exit if graceful shutdown hangs
    const shutdownTimeout = setTimeout(() => {
        logger_1.logger.error('Graceful shutdown timeout (10s) - forcing exit');
        process.exit(1);
    }, 10000); // 10 second timeout
    try {
        // Step 1: Close Fastify (stop accepting new requests, release port immediately)
        logger_1.logger.info('[Shutdown] Closing Fastify server...');
        await fastify.close();
        logger_1.logger.info('[Shutdown] ✅ Fastify closed');
        // Step 2: Stop all workers (allow pending operations to complete)
        logger_1.logger.info('[Shutdown] Stopping workers...');
        if (teamDataSyncWorker)
            teamDataSyncWorker.stop();
        if (teamLogoSyncWorker)
            teamLogoSyncWorker.stop();
        if (matchSyncWorker)
            matchSyncWorker.stop();
        if (matchMinuteWorker)
            matchMinuteWorker.stop();
        (0, entitySync_job_1.stopEntitySyncJobs)(); // Stop all entity sync cron jobs
        // CRITICAL: Wait for in-flight operations to complete
        // Workers stopped, but their reconcile queues/pending ops may still be running
        logger_1.logger.info('[Shutdown] Waiting 3s for in-flight operations to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        logger_1.logger.info('[Shutdown] ✅ Workers stopped');
        // Step 3: Disconnect WebSocket
        logger_1.logger.info('[Shutdown] Disconnecting WebSocket...');
        if (websocketService)
            await websocketService.disconnect();
        logger_1.logger.info('[Shutdown] ✅ WebSocket disconnected');
        // Step 4: Close database pool LAST (after all database operations complete)
        logger_1.logger.info('[Shutdown] Closing database pool...');
        await connection_1.pool.end();
        logger_1.logger.info('[Shutdown] ✅ Database pool closed');
        clearTimeout(shutdownTimeout);
        logger_1.logger.info('[Shutdown] ✅ Graceful shutdown complete');
        process.exit(0);
    }
    catch (err) {
        clearTimeout(shutdownTimeout);
        logger_1.logger.error('[Shutdown] Error during graceful shutdown:', err.message);
        process.exit(1);
    }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// CRITICAL FIX: Handle uncaught exceptions and unhandled rejections
// Log the error but DO NOT exit immediately - allow graceful shutdown
process.on('uncaughtException', (err) => {
    logger_1.logger.error('[CRITICAL] Uncaught Exception:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
    });
    // Trigger graceful shutdown
    shutdown().catch(() => process.exit(1));
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('[CRITICAL] Unhandled Promise Rejection:', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise,
    });
    // DO NOT exit - log and continue (most unhandled rejections are not fatal)
});
start();

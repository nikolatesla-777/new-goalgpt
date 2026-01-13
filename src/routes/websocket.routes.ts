/**
 * WebSocket Routes
 *
 * Fastify WebSocket route for real-time match event broadcasting
 * Frontend connects to ws://localhost:3000/ws to receive real-time updates
 *
 * Phase 6: Integrated with LiveMatchCache for event-driven cache invalidation
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { logger } from '../utils/logger';
import { MatchEvent } from '../services/thesports/websocket/event-detector';
import { EventLatencyMonitor } from '../services/thesports/websocket/eventLatencyMonitor';
import { liveMatchCache } from '../services/thesports/match/liveMatchCache.service';
import { generateMinuteText } from '../utils/matchMinuteText';
import { PredictionSettledData, setOnPredictionSettled } from '../services/ai/predictionSettlement.service';

// Store active WebSocket connections
const activeConnections = new Set<any>();

// Latency monitor instance (shared with WebSocketService)
let latencyMonitor: EventLatencyMonitor | null = null;

// Connection statistics
let totalConnections = 0;
let totalDisconnections = 0;
const connectionStartTime = Date.now();

/**
 * Set latency monitor instance (called from server.ts)
 */
export function setLatencyMonitor(monitor: EventLatencyMonitor): void {
  latencyMonitor = monitor;
}

/**
 * Get active connections count
 */
export function getActiveConnections(): number {
  return activeConnections.size;
}

/**
 * Get WebSocket health metrics
 */
export function getWebSocketHealth() {
  const now = Date.now();
  const uptime = now - connectionStartTime;

  return {
    activeConnections: activeConnections.size,
    totalConnections,
    totalDisconnections,
    uptimeMs: uptime,
    uptimeSeconds: Math.floor(uptime / 1000),
    timestamp: now,
  };
}

/**
 * Broadcast event to all connected clients
 *
 * Phase 6 Enhancements:
 * 1. Cache invalidation on score-related events
 * 2. Optimistic data injection for instant frontend updates
 */
export function broadcastEvent(event: MatchEvent, mqttReceivedTs?: number): void {
  // LATENCY MONITORING: Record broadcast sent timestamp
  if (latencyMonitor && mqttReceivedTs) {
    latencyMonitor.recordBroadcastSent(event.type, event.matchId, mqttReceivedTs);
  }

  // Phase 6: Cache Invalidation - Invalidate on score-related events
  const cacheInvalidatingEvents = ['SCORE_CHANGE', 'GOAL', 'GOAL_CANCELLED', 'MATCH_STATE_CHANGE', 'MINUTE_UPDATE'];
  if (cacheInvalidatingEvents.includes(event.type)) {
    liveMatchCache.invalidateMatch(event.matchId, event.type);
    logger.debug(`[WebSocket Route] Cache invalidated for ${event.matchId} (${event.type})`);
  }

  // Phase 6: Optimistic Data - Add pre-computed data for instant frontend updates
  // This allows frontend to update immediately without waiting for API refresh
  let optimisticData: any = null;

  if (event.type === 'SCORE_CHANGE' || event.type === 'GOAL') {
    const eventData = event as any;
    if (eventData.homeScore !== undefined && eventData.awayScore !== undefined) {
      const minute = eventData.minute ?? null;
      const statusId = eventData.statusId ?? 2;
      optimisticData = {
        homeScore: eventData.homeScore,
        awayScore: eventData.awayScore,
        minute: minute,
        minuteText: generateMinuteText(minute, statusId),
        statusId: statusId,
      };
    }
  } else if (event.type === 'MATCH_STATE_CHANGE') {
    const eventData = event as any;
    if (eventData.newStatus !== undefined) {
      const minute = eventData.minute ?? null;
      optimisticData = {
        statusId: eventData.newStatus,
        minute: minute,
        minuteText: generateMinuteText(minute, eventData.newStatus),
      };
    }
  } else if (event.type === 'MINUTE_UPDATE') {
    const eventData = event as any;
    optimisticData = {
      minute: eventData.minute,
      minuteText: generateMinuteText(eventData.minute, eventData.statusId),
      statusId: eventData.statusId,
    };
  }

  // Spread event first, then override with explicit properties to avoid duplicates
  const message = JSON.stringify({
    ...event,
    type: event.type,
    matchId: event.matchId,
    optimistic: optimisticData,  // Phase 6: Optimistic data for instant updates
    timestamp: Date.now(),
  });

  let sentCount = 0;
  let errorCount = 0;
  const broadcastStartTs = Date.now();

  // CRITICAL DEBUG: Log active connections before broadcast
  const connectionCount = activeConnections.size;
  if (connectionCount === 0) {
    logger.warn(`[WebSocket Route] BROADCAST FAILED: No active connections for ${event.type} (${event.matchId})`);
    return;
  }

  logger.info(`[WebSocket Route] Broadcasting ${event.type} to ${connectionCount} connections`);

  activeConnections.forEach((socket) => {
    try {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(message);
        sentCount++;
      } else {
        // Remove closed connections
        logger.debug(`[WebSocket Route] Removing connection with readyState=${socket.readyState}`);
        activeConnections.delete(socket);
      }
    } catch (error: any) {
      logger.error(`[WebSocket Route] Error sending message to client:`, error);
      errorCount++;
      activeConnections.delete(socket);
    }
  });

  const broadcastDuration = Date.now() - broadcastStartTs;

  logger.info(
    `[WebSocket Route] Broadcasted ${event.type} to ${sentCount}/${connectionCount} clients ` +
    `(${errorCount} errors, ${broadcastDuration}ms)${optimisticData ? ' [+optimistic]' : ''}`
  );
}

/**
 * Broadcast prediction settlement event to all connected clients
 * Phase 3: Real-time prediction result updates
 *
 * @param data - Settlement data containing prediction result
 */
export function broadcastPredictionSettled(data: PredictionSettledData): void {
  const message = JSON.stringify({
    type: 'PREDICTION_SETTLED',
    predictionId: data.predictionId,
    matchId: data.matchId,
    botName: data.botName,
    prediction: data.prediction,
    result: data.result,
    resultReason: data.resultReason,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    finalScore: data.finalScore,
    timestamp: data.timestamp,
  });

  let sentCount = 0;
  let errorCount = 0;

  activeConnections.forEach((socket) => {
    try {
      if (socket.readyState === 1) {
        socket.send(message);
        sentCount++;
      } else {
        activeConnections.delete(socket);
      }
    } catch (error: any) {
      logger.error(`[WebSocket Route] Error sending settlement to client:`, error);
      errorCount++;
      activeConnections.delete(socket);
    }
  });

  if (sentCount > 0) {
    logger.info(
      `[WebSocket Route] Broadcasted PREDICTION_SETTLED (${data.result}) to ${sentCount} clients ` +
      `- ${data.botName}: ${data.homeTeam} vs ${data.awayTeam}`
    );
  }
}

// Initialize the settlement callback when this module loads
setOnPredictionSettled(broadcastPredictionSettled);

export default async function websocketRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // WebSocket route: /ws
  // @fastify/websocket v8+: first param is SocketStream which contains .socket (WebSocket)
  fastify.get('/ws', { websocket: true }, (connection /* SocketStream */, req) => {
    // CRITICAL DIAGNOSTIC: Use process.stdout.write for immediate flush
    process.stdout.write('[WS-ENTRY] Handler entered at ' + Date.now() + '\\n');

    try {
      const clientId = req.socket?.remoteAddress || 'unknown';

      // v8 API: SocketStream has .socket property containing the actual WebSocket
      const socket = connection.socket;

      console.log(`[WS-DIAGNOSTIC] Socket type: ${typeof socket}, has send: ${typeof socket?.send}`);
      logger.info(`[WebSocket Route] New client connected: ${clientId}`);

      // Verify socket has required WebSocket methods
      if (typeof socket?.send !== 'function') {
        logger.error(`[WebSocket Route] Invalid socket object - missing send method`);
        return;
      }

      // Add connection to active set
      activeConnections.add(socket);
      totalConnections++;

      logger.info(`[WebSocket Route] Active connections: ${activeConnections.size}`);

      // Send welcome message
      socket.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'WebSocket connected successfully',
        timestamp: Date.now(),
      }));


      // Handle incoming messages (if needed)
      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug(`[WebSocket Route] Received message from client ${clientId}:`, data);

          // Handle ping/pong for keepalive
          if (data.type === 'PING') {
            socket.send(JSON.stringify({
              type: 'PONG',
              timestamp: Date.now(),
            }));
          }
        } catch (error: any) {
          logger.warn(`[WebSocket Route] Invalid message from client ${clientId}:`, error.message);
        }
      });

      // Handle connection close
      socket.on('close', () => {
        logger.info(`[WebSocket Route] Client disconnected: ${clientId}`);
        activeConnections.delete(socket);
        totalDisconnections++;
      });

      // Handle connection error
      socket.on('error', (error: Error) => {
        logger.error(`[WebSocket Route] Connection error for client ${clientId}:`, error);
        activeConnections.delete(socket);
        totalDisconnections++;
      });
    } catch (connectionError: any) {
      logger.error(`[WebSocket Route] Failed to initialize WebSocket connection:`, connectionError);
    }
  });

  logger.info('[WebSocket Route] WebSocket route registered at /ws');
}


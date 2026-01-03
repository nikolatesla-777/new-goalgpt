/**
 * WebSocket Routes
 * 
 * Fastify WebSocket route for real-time match event broadcasting
 * Frontend connects to ws://localhost:3000/ws to receive real-time updates
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { logger } from '../utils/logger';
import { MatchEvent } from '../services/thesports/websocket/event-detector';
import { EventLatencyMonitor } from '../services/thesports/websocket/eventLatencyMonitor';

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
 */
export function broadcastEvent(event: MatchEvent, mqttReceivedTs?: number): void {
  // LATENCY MONITORING: Record broadcast sent timestamp
  if (latencyMonitor && mqttReceivedTs) {
    latencyMonitor.recordBroadcastSent(event.type, event.matchId, mqttReceivedTs);
  }

  const message = JSON.stringify({
    type: event.type,
    matchId: event.matchId,
    ...event,
    timestamp: Date.now(),
  });

  let sentCount = 0;
  let errorCount = 0;
  const broadcastStartTs = Date.now();

  activeConnections.forEach((socket) => {
    try {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(message);
        sentCount++;
      } else {
        // Remove closed connections
        activeConnections.delete(socket);
      }
    } catch (error: any) {
      logger.error(`[WebSocket Route] Error sending message to client:`, error);
      errorCount++;
      activeConnections.delete(socket);
    }
  });

  const broadcastDuration = Date.now() - broadcastStartTs;

  if (sentCount > 0) {
    logger.debug(
      `[WebSocket Route] Broadcasted ${event.type} event to ${sentCount} clients ` +
      `(${errorCount} errors, ${broadcastDuration}ms)`
    );
  }
}

export default async function websocketRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // WebSocket route: /ws
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const clientId = req.socket.remoteAddress || 'unknown';
    const socket = connection.socket as any; // WebSocket socket
    logger.info(`[WebSocket Route] New client connected: ${clientId}`);

    // Add connection to active set
    activeConnections.add(socket);
    totalConnections++;

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
  });

  logger.info('[WebSocket Route] WebSocket route registered at /ws');
}


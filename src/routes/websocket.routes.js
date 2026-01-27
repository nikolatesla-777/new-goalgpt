"use strict";
/**
 * WebSocket Routes
 *
 * Fastify WebSocket route for real-time match event broadcasting
 * Frontend connects to ws://localhost:3000/ws to receive real-time updates
 *
 * Phase 6: Integrated with LiveMatchCache for event-driven cache invalidation
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLatencyMonitor = setLatencyMonitor;
exports.getActiveConnections = getActiveConnections;
exports.getWebSocketHealth = getWebSocketHealth;
exports.broadcastEvent = broadcastEvent;
exports.broadcastPredictionSettled = broadcastPredictionSettled;
exports.default = websocketRoutes;
var logger_1 = require("../utils/logger");
var liveMatchCache_service_1 = require("../services/thesports/match/liveMatchCache.service");
var matchMinuteText_1 = require("../utils/matchMinuteText");
var memoryCache_1 = require("../utils/cache/memoryCache");
var predictionSettlement_service_1 = require("../services/ai/predictionSettlement.service");
// Store active WebSocket connections
var activeConnections = new Set();
// Latency monitor instance (shared with WebSocketService)
var latencyMonitor = null;
// Connection statistics
var totalConnections = 0;
var totalDisconnections = 0;
var connectionStartTime = Date.now();
/**
 * Set latency monitor instance (called from server.ts)
 */
function setLatencyMonitor(monitor) {
    latencyMonitor = monitor;
}
/**
 * Get active connections count
 */
function getActiveConnections() {
    return activeConnections.size;
}
/**
 * Get WebSocket health metrics
 */
function getWebSocketHealth() {
    var now = Date.now();
    var uptime = now - connectionStartTime;
    return {
        activeConnections: activeConnections.size,
        totalConnections: totalConnections,
        totalDisconnections: totalDisconnections,
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
function broadcastEvent(event, mqttReceivedTs) {
    var _a, _b, _c;
    // LATENCY MONITORING: Record broadcast sent timestamp
    if (latencyMonitor && mqttReceivedTs) {
        latencyMonitor.recordBroadcastSent(event.type, event.matchId, mqttReceivedTs);
    }
    /// Phase 6: Cache Invalidation - Invalidate on score-related events
    var cacheInvalidatingEvents = ['SCORE_CHANGE', 'GOAL', 'GOAL_CANCELLED', 'MATCH_STATE_CHANGE', 'MINUTE_UPDATE'];
    if (cacheInvalidatingEvents.includes(event.type)) {
        liveMatchCache_service_1.liveMatchCache.invalidateMatch(event.matchId, event.type);
        // Phase 5: Also invalidate memory cache for getMatchFull endpoint
        memoryCache_1.memoryCache.invalidateMatch(event.matchId);
        logger_1.logger.debug("[WebSocket Route] Cache invalidated for ".concat(event.matchId, " (").concat(event.type, ")"));
    }
    // Phase 6: Optimistic Data - Add pre-computed data for instant frontend updates
    // This allows frontend to update immediately without waiting for API refresh
    var optimisticData = null;
    if (event.type === 'SCORE_CHANGE' || event.type === 'GOAL') {
        var eventData = event;
        if (eventData.homeScore !== undefined && eventData.awayScore !== undefined) {
            var minute = (_a = eventData.minute) !== null && _a !== void 0 ? _a : null;
            var statusId = (_b = eventData.statusId) !== null && _b !== void 0 ? _b : 2;
            optimisticData = {
                homeScore: eventData.homeScore,
                awayScore: eventData.awayScore,
                minute: minute,
                minuteText: (0, matchMinuteText_1.generateMinuteText)(minute, statusId),
                statusId: statusId,
            };
        }
    }
    else if (event.type === 'MATCH_STATE_CHANGE') {
        var eventData = event;
        if (eventData.newStatus !== undefined) {
            var minute = (_c = eventData.minute) !== null && _c !== void 0 ? _c : null;
            optimisticData = {
                statusId: eventData.newStatus,
                minute: minute,
                minuteText: (0, matchMinuteText_1.generateMinuteText)(minute, eventData.newStatus),
            };
        }
    }
    else if (event.type === 'MINUTE_UPDATE') {
        var eventData = event;
        optimisticData = {
            minute: eventData.minute,
            minuteText: (0, matchMinuteText_1.generateMinuteText)(eventData.minute, eventData.statusId),
            statusId: eventData.statusId,
        };
    }
    // Spread event first, then override with explicit properties to avoid duplicates
    var message = JSON.stringify(__assign(__assign({}, event), { type: event.type, matchId: event.matchId, optimistic: optimisticData, timestamp: Date.now() }));
    var sentCount = 0;
    var errorCount = 0;
    var broadcastStartTs = Date.now();
    // CRITICAL DEBUG: Log active connections before broadcast
    var connectionCount = activeConnections.size;
    if (connectionCount === 0) {
        logger_1.logger.warn("[WebSocket Route] BROADCAST FAILED: No active connections for ".concat(event.type, " (").concat(event.matchId, ")"));
        return;
    }
    logger_1.logger.info("[WebSocket Route] Broadcasting ".concat(event.type, " to ").concat(connectionCount, " connections"));
    activeConnections.forEach(function (socket) {
        try {
            if (socket.readyState === 1) { // WebSocket.OPEN
                socket.send(message);
                sentCount++;
            }
            else {
                // Remove closed connections
                logger_1.logger.debug("[WebSocket Route] Removing connection with readyState=".concat(socket.readyState));
                activeConnections.delete(socket);
            }
        }
        catch (error) {
            logger_1.logger.error("[WebSocket Route] Error sending message to client:", error);
            errorCount++;
            activeConnections.delete(socket);
        }
    });
    var broadcastDuration = Date.now() - broadcastStartTs;
    logger_1.logger.info("[WebSocket Route] Broadcasted ".concat(event.type, " to ").concat(sentCount, "/").concat(connectionCount, " clients ") +
        "(".concat(errorCount, " errors, ").concat(broadcastDuration, "ms)").concat(optimisticData ? ' [+optimistic]' : ''));
}
/**
 * Broadcast prediction settlement event to all connected clients
 * Phase 3: Real-time prediction result updates
 *
 * @param data - Settlement data containing prediction result
 */
function broadcastPredictionSettled(data) {
    var message = JSON.stringify({
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
    var sentCount = 0;
    var errorCount = 0;
    activeConnections.forEach(function (socket) {
        try {
            if (socket.readyState === 1) {
                socket.send(message);
                sentCount++;
            }
            else {
                activeConnections.delete(socket);
            }
        }
        catch (error) {
            logger_1.logger.error("[WebSocket Route] Error sending settlement to client:", error);
            errorCount++;
            activeConnections.delete(socket);
        }
    });
    if (sentCount > 0) {
        logger_1.logger.info("[WebSocket Route] Broadcasted PREDICTION_SETTLED (".concat(data.result, ") to ").concat(sentCount, " clients ") +
            "- ".concat(data.botName, ": ").concat(data.homeTeam, " vs ").concat(data.awayTeam));
    }
}
// Initialize the settlement callback when this module loads
(0, predictionSettlement_service_1.setOnPredictionSettled)(broadcastPredictionSettled);
function websocketRoutes(fastify, options) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // WebSocket route: /ws
            // @fastify/websocket v8+: first param is SocketStream which contains .socket (WebSocket)
            fastify.get('/ws', { websocket: true }, function (connection /* SocketStream */, req) {
                var _a;
                // CRITICAL DIAGNOSTIC: Use process.stdout.write for immediate flush
                process.stdout.write('[WS-ENTRY] Handler entered at ' + Date.now() + '\\n');
                try {
                    var clientId_1 = ((_a = req.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) || 'unknown';
                    // v8 API: SocketStream has .socket property containing the actual WebSocket
                    var socket_1 = connection.socket;
                    console.log("[WS-DIAGNOSTIC] Socket type: ".concat(typeof socket_1, ", has send: ").concat(typeof (socket_1 === null || socket_1 === void 0 ? void 0 : socket_1.send)));
                    logger_1.logger.info("[WebSocket Route] New client connected: ".concat(clientId_1));
                    // Verify socket has required WebSocket methods
                    if (typeof (socket_1 === null || socket_1 === void 0 ? void 0 : socket_1.send) !== 'function') {
                        logger_1.logger.error("[WebSocket Route] Invalid socket object - missing send method");
                        return;
                    }
                    // Add connection to active set
                    activeConnections.add(socket_1);
                    totalConnections++;
                    logger_1.logger.info("[WebSocket Route] Active connections: ".concat(activeConnections.size));
                    // Send welcome message - UNIQUE STRING TO VERIFY HANDLER RUNS
                    socket_1.send(JSON.stringify({
                        type: 'CONNECTED_FROM_HANDLER',
                        message: '*** HANDLER CODE RUNS ***',
                        timestamp: Date.now(),
                    }));
                    // Heartbeat to keep connection alive (fixes Nginx timeout)
                    var pingInterval_1 = setInterval(function () {
                        if (socket_1.readyState === 1) {
                            socket_1.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
                        }
                        else {
                            clearInterval(pingInterval_1);
                        }
                    }, 15000); // Send ping every 15 seconds (aggressive keepalive)
                    // Handle incoming messages (if needed)
                    socket_1.on('message', function (message) {
                        try {
                            var data = JSON.parse(message.toString());
                            // logger.debug(`[WebSocket Route] Received message from client ${clientId}:`, data);
                            // Handle ping/pong for keepalive
                            if (data.type === 'PING') {
                                socket_1.send(JSON.stringify({
                                    type: 'PONG',
                                    timestamp: Date.now(),
                                }));
                            }
                        }
                        catch (error) {
                            logger_1.logger.warn("[WebSocket Route] Invalid message from client ".concat(clientId_1, ":"), error.message);
                        }
                    });
                    // Handle connection close
                    socket_1.on('close', function () {
                        clearInterval(pingInterval_1);
                        logger_1.logger.info("[WebSocket Route] Client disconnected: ".concat(clientId_1));
                        activeConnections.delete(socket_1);
                        totalDisconnections++;
                    });
                    // Handle connection error
                    socket_1.on('error', function (error) {
                        clearInterval(pingInterval_1);
                        logger_1.logger.error("[WebSocket Route] Connection error for client ".concat(clientId_1, ":"), error);
                        activeConnections.delete(socket_1);
                        totalDisconnections++;
                    });
                }
                catch (connectionError) {
                    logger_1.logger.error("[WebSocket Route] Failed to initialize WebSocket connection:", connectionError);
                }
            });
            logger_1.logger.info('[WebSocket Route] WebSocket route registered at /ws');
            return [2 /*return*/];
        });
    });
}

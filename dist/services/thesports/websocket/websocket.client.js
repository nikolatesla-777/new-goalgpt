"use strict";
/**
 * MQTT Client (Refactored from WebSocket)
 *
 * Manages MQTT connection to TheSports API
 * Uses MQTT protocol instead of WebSocket
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const logger_1 = require("../../../utils/logger");
const obsLogger_1 = require("../../../utils/obsLogger");
const config_1 = require("../../../config");
const websocket_parser_1 = require("./websocket.parser");
class WebSocketClient {
    constructor(clientConfig) {
        this.client = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.isConnected = false;
        this.messageHandlers = [];
        this.topic = 'thesports/football/match/v1';
        // Phase 4-2: MQTT message rate tracking
        this.messageCount = 0;
        this.lastRateLogTime = Date.now();
        this.rateLogInterval = null;
        this.config = {
            host: clientConfig?.host || config_1.config.thesports?.mqtt?.host || 'mqtt://mq.thesports.com',
            user: clientConfig?.user || config_1.config.thesports?.user || '',
            secret: clientConfig?.secret || config_1.config.thesports?.secret || '',
            reconnectAttempts: clientConfig?.reconnectAttempts || 5,
            reconnectDelay: clientConfig?.reconnectDelay || 1000,
        };
        this.parser = new websocket_parser_1.WebSocketParser();
        this.maxReconnectAttempts = this.config.reconnectAttempts || 5;
        this.reconnectDelay = this.config.reconnectDelay || 1000;
        this.connectionId = Math.random().toString(36).substring(2, 10);
        // Phase 4-2: Start periodic rate logging (every 30 seconds)
        this.startRateLogging();
    }
    /**
     * Phase 4-2: Start periodic rate logging
     */
    startRateLogging() {
        // Clear existing interval if any
        if (this.rateLogInterval) {
            clearInterval(this.rateLogInterval);
        }
        // Log rate every 30 seconds
        this.rateLogInterval = setInterval(() => {
            this.logMessageRate();
        }, 30000);
    }
    /**
     * Phase 4-2: Log message rate (every 100 messages OR 30 seconds)
     */
    logMessageRate() {
        if (this.messageCount === 0) {
            return; // No messages to log
        }
        const now = Date.now();
        const windowSec = Math.floor((now - this.lastRateLogTime) / 1000);
        (0, obsLogger_1.logEvent)('info', 'websocket.msg.rate', {
            messages_since_last: this.messageCount,
            window_sec: windowSec,
            topics: [this.topic],
            connection_id: this.connectionId,
        });
        // Reset counters
        this.messageCount = 0;
        this.lastRateLogTime = now;
    }
    /**
     * Connect to MQTT broker
     */
    async connect() {
        if (this.isConnected && this.client?.connected) {
            logger_1.logger.info('MQTT already connected');
            return;
        }
        return new Promise((resolve, reject) => {
            try {
                (0, obsLogger_1.logEvent)('info', 'websocket.connecting', {
                    host: this.config.host,
                    user: this.config.user,
                });
                this.client = mqtt_1.default.connect(this.config.host, {
                    username: this.config.user,
                    password: this.config.secret,
                    reconnectPeriod: this.reconnectDelay,
                    connectTimeout: 10000,
                    keepalive: 60,
                });
                this.client.on('connect', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.reconnectDelay = this.config.reconnectDelay || 1000;
                    (0, obsLogger_1.logEvent)('info', 'websocket.connected', {
                        host: this.config.host,
                        user: this.config.user,
                    });
                    // Subscribe to topic
                    this.client?.subscribe(this.topic, (err) => {
                        if (err) {
                            logger_1.logger.error('Failed to subscribe to MQTT topic:', err);
                            reject(err);
                        }
                        else {
                            (0, obsLogger_1.logEvent)('info', 'websocket.subscribed', {
                                topics: [this.topic],
                            });
                            resolve();
                        }
                    });
                });
                this.client.on('message', (topic, message) => {
                    // Phase 4-2: Track message count for rate logging
                    this.messageCount++;
                    // Log rate if we hit 100 messages
                    if (this.messageCount >= 100) {
                        this.logMessageRate();
                    }
                    this.handleMessage(message);
                });
                this.client.on('error', (error) => {
                    logger_1.logger.error('MQTT error:', error);
                    this.isConnected = false;
                    if (!this.client?.connected) {
                        reject(error);
                    }
                });
                this.client.on('close', () => {
                    (0, obsLogger_1.logEvent)('warn', 'websocket.disconnected', {
                        reason: 'connection closed',
                    });
                    this.isConnected = false;
                    // Phase 4-2: Cleanup rate logging interval on close
                    if (this.rateLogInterval) {
                        clearInterval(this.rateLogInterval);
                        this.rateLogInterval = null;
                    }
                    this.handleReconnect();
                });
                this.client.on('offline', () => {
                    (0, obsLogger_1.logEvent)('warn', 'websocket.disconnected', {
                        reason: 'client went offline',
                    });
                    this.isConnected = false;
                });
                this.client.on('reconnect', () => {
                    logger_1.logger.info('MQTT reconnecting...');
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to create MQTT connection:', error);
                reject(error);
            }
        });
    }
    /**
     * Handle incoming MQTT message
     */
    handleMessage(message) {
        try {
            // Parse JSON array from MQTT payload
            const rawData = typeof message === 'string' ? message : message.toString();
            logger_1.logger.info(`[MQTT.client] Raw MQTT message (before parse): ${rawData.slice(0, 200)}...`);
            const data = JSON.parse(rawData);
            logger_1.logger.info(`[MQTT.client] After JSON.parse - type: ${typeof data}, isArray: ${Array.isArray(data)}`);
            // DEBUG: Log raw message structure
            const keys = Object.keys(data);
            logger_1.logger.info(`[MQTT.client] Raw message keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}, total: ${keys.length}`);
            // DEBUG: Log first message content
            if (keys.length > 0) {
                const firstKey = keys[0];
                const firstMsg = data[firstKey];
                logger_1.logger.info(`[MQTT.client] First message (key="${firstKey}"): ${JSON.stringify(firstMsg).slice(0, 200)}...`);
            }
            // MQTT messages are JSON arrays, pass to parser
            const parsedMessage = this.parser.parseMQTTMessage(data);
            // DEBUG: Log parse result
            if (!parsedMessage) {
                logger_1.logger.warn(`[MQTT.client] parseMQTTMessage returned NULL - message filtered`);
                return;
            }
            logger_1.logger.info(`[MQTT.client] Parsed message - calling ${this.messageHandlers.length} handlers`);
            // Notify handlers
            this.messageHandlers.forEach(handler => {
                try {
                    handler(parsedMessage);
                }
                catch (error) {
                    logger_1.logger.error('Error in message handler:', error);
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to handle MQTT message:', error);
        }
    }
    /**
     * Handle reconnection
     */
    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('Max reconnection attempts reached, giving up');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        logger_1.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(async () => {
            try {
                await this.connect();
            }
            catch (error) {
                logger_1.logger.error('Reconnection failed:', error);
                this.handleReconnect();
            }
        }, delay);
    }
    /**
     * Register message handler
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    /**
     * Remove message handler
     */
    offMessage(handler) {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    }
    /**
     * Disconnect
     */
    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
        this.isConnected = false;
        (0, obsLogger_1.logEvent)('warn', 'websocket.disconnected', {
            reason: 'manual disconnect',
        });
        // Phase 4-2: Cleanup rate logging
        if (this.rateLogInterval) {
            clearInterval(this.rateLogInterval);
            this.rateLogInterval = null;
        }
        // Log final rate before disconnect
        if (this.messageCount > 0) {
            this.logMessageRate();
        }
    }
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return this.isConnected && this.client?.connected === true;
    }
}
exports.WebSocketClient = WebSocketClient;

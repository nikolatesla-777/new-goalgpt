/**
 * MQTT Client (Refactored from WebSocket)
 * 
 * Manages MQTT connection to TheSports API
 * Uses MQTT protocol instead of WebSocket
 */

import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';
import { config } from '../../../config';
import { WebSocketParser } from './websocket.parser';
import { WebSocketMessage } from '../../../types/thesports/websocket/websocket.types';

export interface MQTTClientConfig {
  host: string;
  user: string;
  secret: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class WebSocketClient {
  private client: MqttClient | null = null;
  private config: MQTTClientConfig;
  private parser: WebSocketParser;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnected = false;
  private messageHandlers: Array<(message: WebSocketMessage) => void> = [];
  private topic = 'thesports/football/match/v1';
  
  // Phase 4-2: MQTT message rate tracking
  private messageCount = 0;
  private lastRateLogTime = Date.now();
  private rateLogInterval: NodeJS.Timeout | null = null;
  private connectionId: string;

  constructor(clientConfig?: Partial<MQTTClientConfig>) {
    this.config = {
      host: clientConfig?.host || config.thesports?.mqtt?.host || 'mqtt://mq.thesports.com',
      user: clientConfig?.user || config.thesports?.user || '',
      secret: clientConfig?.secret || config.thesports?.secret || '',
      reconnectAttempts: clientConfig?.reconnectAttempts || 5,
      reconnectDelay: clientConfig?.reconnectDelay || 1000,
    };

    this.parser = new WebSocketParser();
    this.maxReconnectAttempts = this.config.reconnectAttempts || 5;
    this.reconnectDelay = this.config.reconnectDelay || 1000;
    this.connectionId = Math.random().toString(36).substring(2, 10);
    
    // Phase 4-2: Start periodic rate logging (every 30 seconds)
    this.startRateLogging();
  }

  /**
   * Phase 4-2: Start periodic rate logging
   */
  private startRateLogging(): void {
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
  private logMessageRate(): void {
    if (this.messageCount === 0) {
      return; // No messages to log
    }

    const now = Date.now();
    const windowSec = Math.floor((now - this.lastRateLogTime) / 1000);
    
    logEvent('info', 'websocket.msg.rate', {
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
  async connect(): Promise<void> {
    if (this.isConnected && this.client?.connected) {
      logger.info('MQTT already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        logEvent('info', 'websocket.connecting', {
          host: this.config.host,
          user: this.config.user,
        });

        this.client = mqtt.connect(this.config.host, {
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
          logEvent('info', 'websocket.connected', {
            host: this.config.host,
            user: this.config.user,
          });

          // Subscribe to topic
          this.client?.subscribe(this.topic, (err) => {
            if (err) {
              logger.error('Failed to subscribe to MQTT topic:', err);
              reject(err);
            } else {
              logEvent('info', 'websocket.subscribed', {
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
          logger.error('MQTT error:', error);
          this.isConnected = false;
          if (!this.client?.connected) {
            reject(error);
          }
        });

        this.client.on('close', () => {
          logEvent('warn', 'websocket.disconnected', {
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
          logEvent('warn', 'websocket.disconnected', {
            reason: 'client went offline',
          });
          this.isConnected = false;
        });

        this.client.on('reconnect', () => {
          logger.info('MQTT reconnecting...');
        });

      } catch (error: any) {
        logger.error('Failed to create MQTT connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming MQTT message
   */
  private handleMessage(message: Buffer | string): void {
    try {
      // Parse JSON array from MQTT payload
      const rawData = typeof message === 'string' ? message : message.toString();
      const data = JSON.parse(rawData);

      // DEBUG: Log raw message structure
      const keys = Object.keys(data);
      logger.info(`[MQTT.client] Raw message keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}, total: ${keys.length}`);

      // DEBUG: Log first message content
      if (keys.length > 0) {
        const firstKey = keys[0];
        const firstMsg = data[firstKey];
        logger.info(`[MQTT.client] First message (key="${firstKey}"): ${JSON.stringify(firstMsg).slice(0, 200)}...`);
      }

      // MQTT messages are JSON arrays, pass to parser
      const parsedMessage = this.parser.parseMQTTMessage(data);

      // DEBUG: Log parse result
      if (!parsedMessage) {
        logger.warn(`[MQTT.client] parseMQTTMessage returned NULL - message filtered`);
        return;
      }

      logger.info(`[MQTT.client] Parsed message - calling ${this.messageHandlers.length} handlers`);

      // Notify handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(parsedMessage);
        } catch (error: any) {
          logger.error('Error in message handler:', error);
        }
      });
    } catch (error: any) {
      logger.error('Failed to handle MQTT message:', error);
    }
  }

  /**
   * Handle reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error: any) {
        logger.error('Reconnection failed:', error);
        this.handleReconnect();
      }
    }, delay);
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Remove message handler
   */
  offMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    
    this.isConnected = false;
    logEvent('warn', 'websocket.disconnected', {
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
  getConnectionStatus(): boolean {
    return this.isConnected && this.client?.connected === true;
  }
}

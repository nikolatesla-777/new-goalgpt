import dotenv from 'dotenv';
import { THESPORTS_BASE_URL, MQTT_CONFIG } from './api-endpoints';

dotenv.config();

/**
 * Configuration
 */
export const config = {
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'goalgpt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },

  // TheSports API
  thesports: {
    baseUrl: process.env.THESPORTS_API_BASE_URL || THESPORTS_BASE_URL,
    websocketUrl: process.env.THESPORTS_WEBSOCKET_URL || 'wss://api.thesports.com/v1/football/ws',
    mqtt: {
      host: process.env.THESPORTS_MQTT_HOST || MQTT_CONFIG.host,
      topic: process.env.THESPORTS_MQTT_TOPIC || MQTT_CONFIG.topic,
    },
    secret: process.env.THESPORTS_API_SECRET || '',
    user: process.env.THESPORTS_API_USER || 'goalgpt',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;


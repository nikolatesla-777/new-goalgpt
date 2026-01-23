"use strict";
/**
 * Redis Manager - Singleton
 *
 * Centralized Redis connection management for LiveMatchOrchestrator.
 * Provides distributed locking and caching capabilities.
 *
 * @module core/RedisManager
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisManager = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
class RedisManager {
    /**
     * Get or create Redis singleton instance
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = this.createRedisClient();
        }
        return this.instance;
    }
    /**
     * Create Redis client with retry strategy
     */
    static createRedisClient() {
        const redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0', 10),
            // Retry strategy: exponential backoff
            retryStrategy: (times) => {
                if (times > this.MAX_RECONNECT_ATTEMPTS) {
                    logger_1.logger.error('[Redis] Max reconnect attempts reached, giving up');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 50, 2000); // Max 2 seconds
                logger_1.logger.warn(`[Redis] Reconnecting... attempt ${times}, delay ${delay}ms`);
                this.reconnectAttempts = times;
                return delay;
            },
            // Connection timeout
            connectTimeout: 10000,
            // Command timeout
            commandTimeout: 5000,
            // Lazy connect (don't block server startup)
            lazyConnect: false,
            // Keep-alive
            keepAlive: 30000,
        });
        // Event handlers
        redis.on('connect', () => {
            logger_1.logger.info('[Redis] Connected successfully');
            this.reconnectAttempts = 0;
        });
        redis.on('ready', () => {
            logger_1.logger.info('[Redis] Ready to accept commands');
        });
        redis.on('error', (error) => {
            logger_1.logger.error('[Redis] Connection error:', error);
        });
        redis.on('close', () => {
            logger_1.logger.warn('[Redis] Connection closed');
        });
        redis.on('reconnecting', () => {
            logger_1.logger.info('[Redis] Reconnecting to Redis...');
        });
        redis.on('end', () => {
            logger_1.logger.warn('[Redis] Connection ended');
        });
        return redis;
    }
    /**
     * Acquire distributed lock with timeout
     *
     * CRITICAL FIX: Graceful degradation when Redis unavailable.
     * If Redis is not connected, returns true to allow writes (single-node fallback).
     * This prevents complete system failure when Redis is down.
     *
     * @param key - Lock key (e.g., 'lock:match:123')
     * @param value - Lock value (e.g., job name)
     * @param ttl - Time to live in seconds (default: 5s)
     * @returns true if lock acquired OR Redis unavailable (graceful degradation)
     */
    static async acquireLock(key, value, ttl = 5) {
        try {
            // GRACEFUL DEGRADATION: If Redis not connected, allow writes without lock
            // This is a single-node fallback - no distributed coordination but at least writes proceed
            if (!this.instance || this.instance.status !== 'ready') {
                logger_1.logger.warn(`[Redis] Not connected (status=${this.instance?.status}), bypassing lock for ${key} - GRACEFUL DEGRADATION`);
                return true; // Allow write without lock
            }
            const redis = this.getInstance();
            const result = await redis.set(key, value, 'EX', ttl, 'NX');
            return result === 'OK';
        }
        catch (error) {
            // GRACEFUL DEGRADATION: On error, allow writes to proceed
            // Better to have potential race conditions than complete system failure
            logger_1.logger.error(`[Redis] Failed to acquire lock for ${key}:`, error);
            logger_1.logger.warn(`[Redis] GRACEFUL DEGRADATION: Allowing write without lock for ${key}`);
            return true; // Allow write on error
        }
    }
    /**
     * Release distributed lock
     *
     * @param key - Lock key
     * @returns true if lock released, false otherwise
     */
    static async releaseLock(key) {
        try {
            const redis = this.getInstance();
            const result = await redis.del(key);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error(`[Redis] Failed to release lock for ${key}:`, error);
            return false;
        }
    }
    /**
     * Get value from Redis
     */
    static async get(key) {
        try {
            const redis = this.getInstance();
            return await redis.get(key);
        }
        catch (error) {
            logger_1.logger.error(`[Redis] Failed to get key ${key}:`, error);
            return null;
        }
    }
    /**
     * Set value in Redis with optional TTL
     */
    static async set(key, value, ttl) {
        try {
            const redis = this.getInstance();
            if (ttl) {
                await redis.setex(key, ttl, value);
            }
            else {
                await redis.set(key, value);
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error(`[Redis] Failed to set key ${key}:`, error);
            return false;
        }
    }
    /**
     * Check if Redis is available (synchronous status check)
     * Returns true if Redis client is connected and ready
     * Use this for quick availability checks without async ping
     */
    static isAvailable() {
        try {
            if (!this.instance) {
                return false;
            }
            // Check connection status
            return this.instance.status === 'ready' || this.instance.status === 'connecting';
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if Redis is connected and healthy (async with PING)
     */
    static async healthCheck() {
        try {
            const redis = this.getInstance();
            const result = await redis.ping();
            return result === 'PONG';
        }
        catch (error) {
            logger_1.logger.error('[Redis] Health check failed:', error);
            return false;
        }
    }
    /**
     * Close Redis connection (graceful shutdown)
     */
    static async close() {
        if (this.instance) {
            logger_1.logger.info('[Redis] Closing connection...');
            await this.instance.quit();
            this.instance = null;
            logger_1.logger.info('[Redis] Connection closed');
        }
    }
    /**
     * Get Redis client stats
     */
    static getStats() {
        if (!this.instance) {
            return { connected: false, reconnectAttempts: 0 };
        }
        return {
            connected: this.instance.status === 'ready',
            status: this.instance.status,
            reconnectAttempts: this.reconnectAttempts,
        };
    }
}
exports.RedisManager = RedisManager;
RedisManager.instance = null;
RedisManager.reconnectAttempts = 0;
RedisManager.MAX_RECONNECT_ATTEMPTS = 10;

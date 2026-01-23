"use strict";
/**
 * Player Sync Worker
 *
 * Background job to sync player data from TheSports API
 * High volume operation - runs less frequently
 * Runs after team sync to ensure FK relationships are available
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerSyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const playerSync_service_1 = require("../services/thesports/player/playerSync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class PlayerSyncWorker {
    constructor() {
        this.weeklyCronJob = null;
        this.dailyCronJob = null;
        this.isRunning = false;
        this.playerSyncService = new playerSync_service_1.PlayerSyncService();
    }
    /**
     * Sync players (smart sync - automatically chooses full or incremental)
     * WARNING: Full sync is a high-volume operation and may take hours
     */
    async syncPlayers() {
        if (this.isRunning) {
            logger_1.logger.warn('Player sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting player sync job...');
            const result = await this.playerSyncService.sync();
            logger_1.logger.info(`Player sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`);
            if (result.isFullUpdate) {
                logger_1.logger.warn('⚠️  Full player sync completed - this is a high-volume operation');
            }
        }
        catch (error) {
            logger_1.logger.error('Player sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use syncPlayers() instead
     */
    async syncAllPlayers() {
        return this.syncPlayers();
    }
    /**
     * Start the worker
     * Full sync weekly on Sunday at 04:00 (after team sync at 03:00)
     * Incremental sync daily at 05:00 (less frequent due to volume)
     * NOTE: Do not trigger full sync immediately on start
     */
    start() {
        if (this.weeklyCronJob || this.dailyCronJob) {
            logger_1.logger.warn('Player sync worker already started');
            return;
        }
        // Full sync weekly on Sunday at 04:00 (after team sync at 03:00)
        // Note: sync() will automatically do full update if no sync state exists
        this.weeklyCronJob = cron.schedule('0 4 * * 0', async () => {
            await this.syncPlayers();
        });
        // Incremental sync daily at 05:00 (less frequent due to volume)
        // Note: sync() will automatically do incremental update if sync state exists
        this.dailyCronJob = cron.schedule('0 5 * * *', async () => {
            // syncPlayers() already has an isRunning guard, keep this lightweight
            await this.syncPlayers();
        });
        // NOTE: Do NOT run initial sync on start (too high volume)
        // User can trigger manually if needed
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'PlayerSyncWorker',
            schedules: {
                weekly_full: '0 4 * * 0',
                daily_incremental: '0 5 * * *',
            },
            note: 'Full sync is high-volume and only runs on weekly schedule; daily run is incremental when sync state exists.',
        });
        logger_1.logger.warn('⚠️  Player sync is high volume - full sync will NOT run automatically on startup');
    }
    /**
     * Stop the worker
     */
    stop() {
        let stoppedAny = false;
        if (this.weeklyCronJob) {
            this.weeklyCronJob.stop();
            this.weeklyCronJob = null;
            stoppedAny = true;
        }
        if (this.dailyCronJob) {
            this.dailyCronJob.stop();
            this.dailyCronJob = null;
            stoppedAny = true;
        }
        if (stoppedAny) {
            logger_1.logger.info('Player sync worker stopped');
        }
    }
}
exports.PlayerSyncWorker = PlayerSyncWorker;

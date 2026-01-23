"use strict";
/**
 * Venue Sync Worker
 *
 * Background job to sync venue/stadium data from TheSports API
 * Critical for "Home Advantage" analysis and future Weather integration
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
exports.VenueSyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const venueSync_service_1 = require("../services/thesports/venue/venueSync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class VenueSyncWorker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.venueSyncService = new venueSync_service_1.VenueSyncService();
    }
    /**
     * Sync all venues (full sync)
     */
    async syncAllVenues() {
        if (this.isRunning) {
            logger_1.logger.warn('Venue sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting venue sync job...');
            const result = await this.venueSyncService.syncAllVenues();
            logger_1.logger.info(`Venue sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
        }
        catch (error) {
            logger_1.logger.error('Venue sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the worker
     * Full sync daily at 04:30 (after referee sync at 04:00)
     * Incremental sync every 12 hours
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Venue sync worker already started');
            return;
        }
        // Full sync daily at 04:30 (after referee sync at 04:00)
        cron.schedule('30 4 * * *', async () => {
            await this.syncAllVenues();
        });
        // Incremental sync every 12 hours
        cron.schedule('30 */12 * * *', async () => {
            if (!this.isRunning) {
                logger_1.logger.info('Starting incremental venue sync...');
                await this.venueSyncService.syncIncremental();
            }
        });
        // Run initial sync on start
        setTimeout(() => {
            this.syncAllVenues();
        }, 25000); // 25 second delay after referee sync
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'VenueSyncWorker',
            schedule: '30 4 * * *, 30 */12 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Venue sync worker stopped');
        }
    }
}
exports.VenueSyncWorker = VenueSyncWorker;

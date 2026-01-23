"use strict";
/**
 * Coach Sync Worker
 *
 * Background job to sync coach/manager data from TheSports API
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
exports.CoachSyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const coachSync_service_1 = require("../services/thesports/coach/coachSync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class CoachSyncWorker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.coachSyncService = new coachSync_service_1.CoachSyncService();
    }
    /**
     * Sync coaches (smart sync - automatically chooses full or incremental)
     */
    async syncCoaches() {
        if (this.isRunning) {
            logger_1.logger.warn('Coach sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting coach sync job...');
            const result = await this.coachSyncService.sync();
            logger_1.logger.info(`Coach sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`);
        }
        catch (error) {
            logger_1.logger.error('Coach sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use syncCoaches() instead
     */
    async syncAllCoaches() {
        return this.syncCoaches();
    }
    /**
     * Start the worker
     * Full sync daily at 03:30 (after team sync at 03:00)
     * Incremental sync every 12 hours
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Coach sync worker already started');
            return;
        }
        // Full sync daily at 03:30 (after team sync at 03:00)
        // Note: sync() will automatically do full update if no sync state exists
        cron.schedule('30 3 * * *', async () => {
            await this.syncCoaches();
        });
        // Incremental sync every 12 hours
        // Note: sync() will automatically do incremental update if sync state exists
        cron.schedule('30 */12 * * *', async () => {
            if (!this.isRunning) {
                await this.syncCoaches();
            }
        });
        // Run initial sync on start (with delay to ensure teams are synced first)
        setTimeout(() => {
            this.syncCoaches();
        }, 15000); // 15 second delay after team sync
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'CoachSyncWorker',
            schedule: '30 3 * * *, 30 */12 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Coach sync worker stopped');
        }
    }
}
exports.CoachSyncWorker = CoachSyncWorker;

"use strict";
/**
 * Referee Sync Worker
 *
 * Background job to sync referee/official data from TheSports API
 * Critical for future "Card/Penalty" AI predictions
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
exports.RefereeSyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const refereeSync_service_1 = require("../services/thesports/referee/refereeSync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class RefereeSyncWorker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.refereeSyncService = new refereeSync_service_1.RefereeSyncService();
    }
    /**
     * Sync all referees (full sync)
     */
    async syncAllReferees() {
        if (this.isRunning) {
            logger_1.logger.warn('Referee sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting referee sync job...');
            const result = await this.refereeSyncService.syncAllReferees();
            logger_1.logger.info(`Referee sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
        }
        catch (error) {
            logger_1.logger.error('Referee sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the worker
     * Full sync daily at 04:00 (after coach sync at 03:30)
     * Incremental sync every 12 hours
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Referee sync worker already started');
            return;
        }
        // Full sync daily at 04:00 (after coach sync at 03:30)
        cron.schedule('0 4 * * *', async () => {
            await this.syncAllReferees();
        });
        // Incremental sync every 12 hours
        cron.schedule('0 */12 * * *', async () => {
            if (!this.isRunning) {
                logger_1.logger.info('Starting incremental referee sync...');
                await this.refereeSyncService.syncIncremental();
            }
        });
        // Run initial sync on start
        setTimeout(() => {
            this.syncAllReferees();
        }, 20000); // 20 second delay after coach sync
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'RefereeSyncWorker',
            schedule: '0 4 * * *, 0 */12 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Referee sync worker stopped');
        }
    }
}
exports.RefereeSyncWorker = RefereeSyncWorker;

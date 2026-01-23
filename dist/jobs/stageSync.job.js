"use strict";
/**
 * Stage Sync Worker
 *
 * Background job to sync stage/tournament phase data from TheSports API
 * Crucial for distinguishing "Group Stage" vs "Finals"
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
exports.StageSyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const stageSync_service_1 = require("../services/thesports/stage/stageSync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class StageSyncWorker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.stageSyncService = new stageSync_service_1.StageSyncService();
    }
    /**
     * Sync all stages (full sync)
     */
    async syncAllStages() {
        if (this.isRunning) {
            logger_1.logger.warn('Stage sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting stage sync job...');
            const result = await this.stageSyncService.syncAllStages();
            logger_1.logger.info(`Stage sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
        }
        catch (error) {
            logger_1.logger.error('Stage sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the worker
     * Full sync daily at 05:30 (after season sync at 05:00)
     * Incremental sync every 12 hours
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Stage sync worker already started');
            return;
        }
        // Full sync daily at 05:30 (after season sync at 05:00)
        cron.schedule('30 5 * * *', async () => {
            await this.syncAllStages();
        });
        // Incremental sync every 12 hours
        cron.schedule('30 */12 * * *', async () => {
            if (!this.isRunning) {
                logger_1.logger.info('Starting incremental stage sync...');
                await this.stageSyncService.syncIncremental();
            }
        });
        // Run initial sync on start
        setTimeout(() => {
            this.syncAllStages();
        }, 35000); // 35 second delay after season sync
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'StageSyncWorker',
            schedule: '30 5 * * *, 30 */12 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Stage sync worker stopped');
        }
    }
}
exports.StageSyncWorker = StageSyncWorker;

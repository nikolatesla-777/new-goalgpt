"use strict";
/**
 * Category Sync Worker
 *
 * Background job to sync category (country/region) data from TheSports API
 * STATUS: Skeleton - waiting for API documentation
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
exports.CategorySyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const categorySync_service_1 = require("../services/thesports/category/categorySync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class CategorySyncWorker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.categorySyncService = new categorySync_service_1.CategorySyncService();
    }
    /**
     * Sync all categories (full sync)
     */
    async syncAllCategories() {
        if (this.isRunning) {
            logger_1.logger.warn('Category sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting category sync job...');
            const result = await this.categorySyncService.syncAllCategories();
            logger_1.logger.info(`Category sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
        }
        catch (error) {
            logger_1.logger.error('Category sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the worker
     * Full sync daily at 01:00 (before competition sync at 02:00)
     * Incremental sync every 12 hours
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Category sync worker already started');
            return;
        }
        // Full sync daily at 01:00 (before competition sync)
        cron.schedule('0 1 * * *', async () => {
            await this.syncAllCategories();
        });
        // Incremental sync every 12 hours
        cron.schedule('0 */12 * * *', async () => {
            if (!this.isRunning) {
                logger_1.logger.info('Starting incremental category sync...');
                await this.categorySyncService.syncIncremental();
            }
        });
        // Run initial sync on start
        this.syncAllCategories();
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'CategorySyncWorker',
            schedule: '0 1 * * *, 0 */12 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Category sync worker stopped');
        }
    }
}
exports.CategorySyncWorker = CategorySyncWorker;

"use strict";
/**
 * Competition Sync Worker
 *
 * Background job to sync competition/league data from TheSports API
 * Runs daily at 02:00 (after match sync) to avoid rate limits
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
exports.CompetitionSyncWorker = void 0;
const cron = __importStar(require("node-cron"));
const leagueSync_service_1 = require("../services/thesports/competition/leagueSync.service");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class CompetitionSyncWorker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.leagueSyncService = new leagueSync_service_1.LeagueSyncService();
    }
    /**
     * Sync competitions (smart sync - automatically chooses full or incremental)
     */
    async syncCompetitions() {
        if (this.isRunning) {
            logger_1.logger.warn('Competition sync is already running, skipping this run.');
            return;
        }
        this.isRunning = true;
        try {
            logger_1.logger.info('Starting competition sync job...');
            const result = await this.leagueSyncService.sync();
            logger_1.logger.info(`Competition sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`);
        }
        catch (error) {
            logger_1.logger.error('Competition sync job error:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use syncCompetitions() instead
     */
    async syncAllCompetitions() {
        return this.syncCompetitions();
    }
    /**
     * Start the worker
     * Runs full sync daily at 02:00, incremental sync every 6 hours
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Competition sync worker already started');
            return;
        }
        // Full sync daily at 02:00 (after match sync at 00:00)
        // Note: sync() will automatically do full update if no sync state exists
        cron.schedule('0 2 * * *', async () => {
            await this.syncCompetitions();
        });
        // Incremental sync every 6 hours
        // Note: sync() will automatically do incremental update if sync state exists
        cron.schedule('0 */6 * * *', async () => {
            if (!this.isRunning) {
                await this.syncCompetitions();
            }
        });
        // Run initial sync on start
        this.syncCompetitions();
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'CompetitionSyncWorker',
            schedule: '0 2 * * *, 0 */6 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Competition sync worker stopped');
        }
    }
}
exports.CompetitionSyncWorker = CompetitionSyncWorker;

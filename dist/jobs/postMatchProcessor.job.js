"use strict";
/**
 * Post Match Processor Job
 *
 * Periodically runs to ensure all ended matches have their data persisted:
 * - Final statistics
 * - All incidents
 * - Final trend data
 * - Player statistics
 * - Standings updates
 *
 * Runs every 30 minutes to catch up on any missed matches.
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
exports.PostMatchProcessorJob = void 0;
const cron = __importStar(require("node-cron"));
const TheSportsAPIManager_1 = require("../core/TheSportsAPIManager"); // Phase 3A: Singleton migration
const postMatchProcessor_1 = require("../services/liveData/postMatchProcessor");
const logger_1 = require("../utils/logger");
class PostMatchProcessorJob {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.client = TheSportsAPIManager_1.theSportsAPI; // Phase 3A: Use singleton
        this.processor = new postMatchProcessor_1.PostMatchProcessor();
    }
    /**
     * Run the processor
     */
    async run() {
        if (this.isRunning) {
            logger_1.logger.warn('[PostMatchJob] Already running, skipping...');
            return;
        }
        this.isRunning = true;
        const startTime = Date.now();
        try {
            logger_1.logger.info('🔄 [PostMatchJob] Processing ended matches...');
            const result = await this.processor.processEndedMatches(50);
            const duration = Date.now() - startTime;
            logger_1.logger.info(`✅ [PostMatchJob] Completed in ${duration}ms: ${result.processed} processed, ${result.success} success, ${result.failed} failed`);
        }
        catch (error) {
            logger_1.logger.error('[PostMatchJob] Job failed:', error.message);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Start the job
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('[PostMatchJob] Job already started');
            return;
        }
        // Run every 30 minutes
        this.cronJob = cron.schedule('*/30 * * * *', async () => {
            await this.run();
        }, { timezone: PostMatchProcessorJob.CRON_TIMEZONE });
        logger_1.logger.info('📊 [PostMatchJob] Job started:');
        logger_1.logger.info('   ⏰ Schedule: Every 30 minutes');
        logger_1.logger.info('   🎯 Target: Recently ended matches missing data');
        logger_1.logger.info('   🕒 Timezone: Europe/Istanbul');
        // Run immediately on start to catch up on missed matches
        setTimeout(() => {
            this.run();
        }, 30000); // 30 seconds after server start
    }
    /**
     * Stop the job
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        logger_1.logger.info('[PostMatchJob] Job stopped');
    }
    /**
     * Get the processor instance for direct use
     */
    getProcessor() {
        return this.processor;
    }
}
exports.PostMatchProcessorJob = PostMatchProcessorJob;
PostMatchProcessorJob.CRON_TIMEZONE = 'Europe/Istanbul';

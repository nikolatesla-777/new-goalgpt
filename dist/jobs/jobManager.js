"use strict";
/**
 * Job Manager - Background Job Scheduler
 *
 * Centralized scheduler for all background jobs using node-cron
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStuckMatchFinisher = runStuckMatchFinisher;
exports.initializeJobs = initializeJobs;
exports.getJobsList = getJobsList;
exports.getNextJobRuns = getNextJobRuns;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../utils/logger");
const JobRunner_1 = require("./framework/JobRunner");
/**
 * PR-8A: Stuck Match Finisher job extracted as separate function
 * Wrapped with JobRunner for overlap guard + timeout + metrics
 */
async function runStuckMatchFinisher() {
    await JobRunner_1.jobRunner.run({
        jobName: 'stuckMatchFinisher',
        overlapGuard: true,
        advisoryLockKey: 910000000099n, // Using available lock key slot
        timeoutMs: 180000, // 3 minutes
    }, async (_ctx) => {
        // Original SQL logic unchanged (direct database write)
        const { pool } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
        const nowTs = Math.floor(Date.now() / 1000);
        // Finish matches that are 90+ minutes and started 2+ hours ago
        const result = await pool.query(`
        UPDATE ts_matches
        SET
          status_id = 8,
          minute = CASE WHEN minute >= 90 THEN minute ELSE 90 END,
          status_id_source = 'auto_finish',
          status_id_timestamp = $1,
          updated_at = NOW()
        WHERE status_id IN (2, 3, 4, 5, 7)
          AND match_time < $2
          AND (minute >= 90 OR match_time < $3)
        RETURNING external_id
      `, [nowTs, nowTs - 7200, nowTs - 14400]); // 2 hours, 4 hours
        if (result.rowCount && result.rowCount > 0) {
            logger_1.logger.info(`✅ Auto-finished ${result.rowCount} stuck matches`);
        }
    });
}
/**
 * All background jobs configuration
 */
const jobs = [
    {
        name: 'Badge Auto-Unlock',
        schedule: '*/5 * * * *', // Every 5 minutes
        handler: async () => {
            const { runBadgeAutoUnlock } = await Promise.resolve().then(() => __importStar(require('./badgeAutoUnlock.job')));
            await runBadgeAutoUnlock();
        },
        enabled: true,
        description: 'Auto-unlock badges based on user activities',
    },
    {
        name: 'Referral Tier 2 Processor',
        schedule: '* * * * *', // Every minute
        handler: async () => {
            const { runReferralTier2 } = await Promise.resolve().then(() => __importStar(require('./referralTier2.job')));
            await runReferralTier2();
        },
        enabled: true,
        description: 'Process Tier 2 referral rewards (first login)',
    },
    {
        name: 'Referral Tier 3 Processor',
        schedule: '* * * * *', // Every minute
        handler: async () => {
            const { runReferralTier3 } = await Promise.resolve().then(() => __importStar(require('./referralTier3.job')));
            await runReferralTier3();
        },
        enabled: true,
        description: 'Process Tier 3 referral rewards (subscription)',
    },
    {
        name: 'Scheduled Notifications',
        schedule: '* * * * *', // Every minute
        handler: async () => {
            const { runScheduledNotifications } = await Promise.resolve().then(() => __importStar(require('./scheduledNotifications.job')));
            await runScheduledNotifications();
        },
        enabled: true,
        description: 'Send scheduled push notifications from queue',
    },
    {
        name: 'Daily Reward Reminders',
        schedule: '0 20 * * *', // Daily at 20:00 (8 PM)
        handler: async () => {
            const { runDailyRewardReminders } = await Promise.resolve().then(() => __importStar(require('./dailyRewardReminders.job')));
            await runDailyRewardReminders();
        },
        enabled: true,
        description: 'Remind users to claim daily rewards',
    },
    {
        name: 'Streak Break Warnings',
        schedule: '0 22 * * *', // Daily at 22:00 (10 PM)
        handler: async () => {
            const { runStreakBreakWarnings } = await Promise.resolve().then(() => __importStar(require('./streakBreakWarnings.job')));
            await runStreakBreakWarnings();
        },
        enabled: true,
        description: 'Warn users about losing login streaks',
    },
    {
        name: 'Subscription Expiry Alerts',
        schedule: '0 10 * * *', // Daily at 10:00 (10 AM)
        handler: async () => {
            const { runSubscriptionExpiryAlerts } = await Promise.resolve().then(() => __importStar(require('./subscriptionExpiryAlerts.job')));
            await runSubscriptionExpiryAlerts();
        },
        enabled: true,
        description: 'Notify VIP users 3 days before expiry',
    },
    {
        name: 'Partner Analytics Rollup',
        schedule: '5 0 * * *', // Daily at 00:05
        handler: async () => {
            const { runPartnerAnalytics } = await Promise.resolve().then(() => __importStar(require('./partnerAnalytics.job')));
            await runPartnerAnalytics();
        },
        enabled: true,
        description: 'Aggregate daily partner performance metrics',
    },
    {
        name: 'Dead Token Cleanup',
        schedule: '0 3 * * 0', // Weekly Sunday at 03:00
        handler: async () => {
            const { runDeadTokenCleanup } = await Promise.resolve().then(() => __importStar(require('./deadTokenCleanup.job')));
            await runDeadTokenCleanup();
        },
        enabled: true,
        description: 'Remove expired/invalid FCM tokens',
    },
    {
        name: 'Old Logs Cleanup',
        schedule: '0 4 1 * *', // Monthly on 1st at 04:00
        handler: async () => {
            const { runOldLogsCleanup } = await Promise.resolve().then(() => __importStar(require('./oldLogsCleanup.job')));
            await runOldLogsCleanup();
        },
        enabled: true,
        description: 'Archive/delete old transaction logs',
    },
    {
        name: 'Stuck Match Finisher',
        schedule: '*/10 * * * *', // Every 10 minutes
        handler: runStuckMatchFinisher, // PR-8A: Use wrapped function
        enabled: true,
        description: 'Auto-finish matches stuck in live status (90+ min or 4+ hours old)',
    },
    {
        name: 'Prediction Matcher',
        schedule: '*/5 * * * *', // Every 5 minutes
        handler: async () => {
            const { predictionMatcherService } = await Promise.resolve().then(() => __importStar(require('../services/ai/predictionMatcher.service')));
            await predictionMatcherService.matchUnmatchedPredictions();
        },
        enabled: true,
        description: 'Match predictions with NULL match_id to actual matches using team names and date',
    },
    {
        name: 'Daily Diary Sync (Midnight)',
        schedule: '0 21 * * *', // Daily at 21:00 UTC = 00:00 TSİ (Turkey)
        handler: async () => {
            const { runDailyDiarySync } = await Promise.resolve().then(() => __importStar(require('./dailyDiarySync.job')));
            await runDailyDiarySync();
        },
        enabled: true,
        description: 'Full diary sync at midnight TSİ for new day',
    },
    {
        name: 'Diary Refresh (10min)',
        schedule: '*/10 * * * *', // Every 10 minutes (TheSports API recommendation)
        handler: async () => {
            const { runDailyDiarySync } = await Promise.resolve().then(() => __importStar(require('./dailyDiarySync.job')));
            await runDailyDiarySync();
        },
        enabled: true,
        description: 'Refresh today\'s diary every 10 minutes per TheSports API recommendation',
    },
    {
        name: 'H2H Pre-Sync',
        schedule: '*/30 * * * *', // Every 30 minutes
        handler: async () => {
            const { runH2HPreSync } = await Promise.resolve().then(() => __importStar(require('./h2hPreSync.job')));
            await runH2HPreSync();
        },
        enabled: true,
        description: 'Pre-sync H2H data for NOT_STARTED matches (ensures H2H tab has data before match starts)',
    },
    {
        name: 'Live Stats Sync',
        schedule: '* * * * *', // Every minute
        handler: async () => {
            const { runStatsSync } = await Promise.resolve().then(() => __importStar(require('./statsSync.job')));
            await runStatsSync();
        },
        enabled: true,
        description: 'Phase 6: Sync live match stats from TheSports API to database (proactive caching)',
    },
    {
        name: 'Lineup Pre-Sync',
        schedule: '*/15 * * * *', // Every 15 minutes
        handler: async () => {
            const { runLineupPreSync } = await Promise.resolve().then(() => __importStar(require('./lineupPreSync.job')));
            await runLineupPreSync();
        },
        enabled: true,
        description: 'Phase 7: Pre-fetch lineups for matches starting in next 60 minutes',
    },
];
/**
 * Initialize and start all background jobs
 */
function initializeJobs() {
    logger_1.logger.info('🤖 Initializing Phase 4 background jobs...');
    const enabledJobs = jobs.filter((j) => j.enabled);
    const disabledJobs = jobs.filter((j) => !j.enabled);
    // Schedule enabled jobs
    enabledJobs.forEach((job) => {
        node_cron_1.default.schedule(job.schedule, async () => {
            const startTime = Date.now();
            logger_1.logger.info(`🔄 Job started: ${job.name}`);
            try {
                await job.handler();
                const duration = Date.now() - startTime;
                logger_1.logger.info(`✅ Job completed: ${job.name} (${duration}ms)`);
            }
            catch (error) {
                const duration = Date.now() - startTime;
                logger_1.logger.error(`❌ Job failed: ${job.name} (${duration}ms)`, {
                    error: error.message,
                    stack: error.stack,
                });
            }
        });
        logger_1.logger.info(`✅ Job scheduled: ${job.name}`);
        logger_1.logger.info(`   Schedule: ${job.schedule}`);
        logger_1.logger.info(`   Description: ${job.description}`);
    });
    // Log disabled jobs
    if (disabledJobs.length > 0) {
        logger_1.logger.info(`⏸️  ${disabledJobs.length} job(s) disabled:`);
        disabledJobs.forEach((job) => {
            logger_1.logger.info(`   - ${job.name}`);
        });
    }
    logger_1.logger.info(`🤖 ${enabledJobs.length} background job(s) initialized successfully`);
    logger_1.logger.info('');
}
/**
 * Get list of all jobs (for admin API)
 */
function getJobsList() {
    return jobs.map((job) => ({
        name: job.name,
        schedule: job.schedule,
        enabled: job.enabled,
        description: job.description,
    }));
}
/**
 * Check if a job is scheduled to run soon
 * Useful for debugging
 */
function getNextJobRuns() {
    const now = new Date();
    return jobs
        .filter((j) => j.enabled)
        .map((job) => {
        // Parse cron expression to estimate next run
        // For simplicity, we'll just return the schedule
        return {
            name: job.name,
            schedule: job.schedule,
            // TODO: Calculate actual next run time from cron expression
        };
    });
}

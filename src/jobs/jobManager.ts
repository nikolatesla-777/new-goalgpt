/**
 * Job Manager - Background Job Scheduler
 *
 * Centralized scheduler for all background jobs using node-cron
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';

interface JobDefinition {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
  description: string;
}

/**
 * All background jobs configuration
 */
const jobs: JobDefinition[] = [
  {
    name: 'Badge Auto-Unlock',
    schedule: '*/5 * * * *', // Every 5 minutes
    handler: async () => {
      const { runBadgeAutoUnlock } = await import('./badgeAutoUnlock.job');
      await runBadgeAutoUnlock();
    },
    enabled: true,
    description: 'Auto-unlock badges based on user activities',
  },
  {
    name: 'Referral Tier 2 Processor',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      const { runReferralTier2 } = await import('./referralTier2.job');
      await runReferralTier2();
    },
    enabled: true,
    description: 'Process Tier 2 referral rewards (first login)',
  },
  {
    name: 'Referral Tier 3 Processor',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      const { runReferralTier3 } = await import('./referralTier3.job');
      await runReferralTier3();
    },
    enabled: true,
    description: 'Process Tier 3 referral rewards (subscription)',
  },
  {
    name: 'Scheduled Notifications',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      const { runScheduledNotifications } = await import('./scheduledNotifications.job');
      await runScheduledNotifications();
    },
    enabled: true,
    description: 'Send scheduled push notifications from queue',
  },
  {
    name: 'Daily Reward Reminders',
    schedule: '0 20 * * *', // Daily at 20:00 (8 PM)
    handler: async () => {
      const { runDailyRewardReminders } = await import('./dailyRewardReminders.job');
      await runDailyRewardReminders();
    },
    enabled: true,
    description: 'Remind users to claim daily rewards',
  },
  {
    name: 'Streak Break Warnings',
    schedule: '0 22 * * *', // Daily at 22:00 (10 PM)
    handler: async () => {
      const { runStreakBreakWarnings } = await import('./streakBreakWarnings.job');
      await runStreakBreakWarnings();
    },
    enabled: true,
    description: 'Warn users about losing login streaks',
  },
  {
    name: 'Subscription Expiry Alerts',
    schedule: '0 10 * * *', // Daily at 10:00 (10 AM)
    handler: async () => {
      const { runSubscriptionExpiryAlerts } = await import('./subscriptionExpiryAlerts.job');
      await runSubscriptionExpiryAlerts();
    },
    enabled: true,
    description: 'Notify VIP users 3 days before expiry',
  },
  {
    name: 'Partner Analytics Rollup',
    schedule: '5 0 * * *', // Daily at 00:05
    handler: async () => {
      const { runPartnerAnalytics } = await import('./partnerAnalytics.job');
      await runPartnerAnalytics();
    },
    enabled: true,
    description: 'Aggregate daily partner performance metrics',
  },
  {
    name: 'Dead Token Cleanup',
    schedule: '0 3 * * 0', // Weekly Sunday at 03:00
    handler: async () => {
      const { runDeadTokenCleanup } = await import('./deadTokenCleanup.job');
      await runDeadTokenCleanup();
    },
    enabled: true,
    description: 'Remove expired/invalid FCM tokens',
  },
  {
    name: 'Old Logs Cleanup',
    schedule: '0 4 1 * *', // Monthly on 1st at 04:00
    handler: async () => {
      const { runOldLogsCleanup } = await import('./oldLogsCleanup.job');
      await runOldLogsCleanup();
    },
    enabled: true,
    description: 'Archive/delete old transaction logs',
  },
  {
    name: 'Stuck Match Finisher',
    schedule: '*/10 * * * *', // Every 10 minutes
    handler: async () => {
      const { pool } = await import('../database/connection');
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
        logger.info(`✅ Auto-finished ${result.rowCount} stuck matches`);
      }
    },
    enabled: true,
    description: 'Auto-finish matches stuck in live status (90+ min or 4+ hours old)',
  },
  {
    name: 'Proactive Status Checker',
    schedule: '*/30 * * * * *', // Every 30 seconds
    handler: async () => {
      const { ProactiveMatchStatusCheckWorker } = await import('./proactiveMatchStatusCheck.job');
      const worker = new ProactiveMatchStatusCheckWorker();
      await worker.checkTodayMatches();
    },
    enabled: true,
    description: 'Check match status via detail_live API and update stuck/outdated matches',
  },
  {
    name: 'Prediction Matcher',
    schedule: '*/5 * * * *', // Every 5 minutes
    handler: async () => {
      const { predictionMatcherService } = await import('../services/ai/predictionMatcher.service');
      await predictionMatcherService.matchUnmatchedPredictions();
    },
    enabled: true,
    description: 'Match predictions with NULL match_id to actual matches using team names and date',
  },
];

/**
 * Initialize and start all background jobs
 */
export function initializeJobs() {
  logger.info('🤖 Initializing Phase 4 background jobs...');

  const enabledJobs = jobs.filter((j) => j.enabled);
  const disabledJobs = jobs.filter((j) => !j.enabled);

  // Schedule enabled jobs
  enabledJobs.forEach((job) => {
    cron.schedule(job.schedule, async () => {
      const startTime = Date.now();
      logger.info(`🔄 Job started: ${job.name}`);

      try {
        await job.handler();
        const duration = Date.now() - startTime;
        logger.info(`✅ Job completed: ${job.name} (${duration}ms)`);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Job failed: ${job.name} (${duration}ms)`, {
          error: error.message,
          stack: error.stack,
        });
      }
    });

    logger.info(`✅ Job scheduled: ${job.name}`);
    logger.info(`   Schedule: ${job.schedule}`);
    logger.info(`   Description: ${job.description}`);
  });

  // Log disabled jobs
  if (disabledJobs.length > 0) {
    logger.info(`⏸️  ${disabledJobs.length} job(s) disabled:`);
    disabledJobs.forEach((job) => {
      logger.info(`   - ${job.name}`);
    });
  }

  logger.info(`🤖 ${enabledJobs.length} background job(s) initialized successfully`);
  logger.info('');
}

/**
 * Get list of all jobs (for admin API)
 */
export function getJobsList() {
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
export function getNextJobRuns() {
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

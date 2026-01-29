/**
 * Job Manager - Background Job Scheduler
 *
 * Centralized scheduler for all background jobs using node-cron
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';
import { matchOrchestrator } from '../modules/matches/services/MatchOrchestrator';
import { FieldUpdate } from '../repositories/match.repository';
import { LIVE_STATUSES_SQL } from '../types/thesports/enums/MatchState.enum';

// PR-8B: Using MatchOrchestrator for atomic match updates

interface JobDefinition {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
  description: string;
}

// PHASE-0: Job execution log status
type JobLogStatus = 'running' | 'success' | 'failed';

/**
 * PHASE-0: Log job execution to database
 * Fire and forget - does not throw on error
 */
async function logJobExecution(params: {
  jobName: string;
  status: JobLogStatus;
  startedAt: Date;
  finishedAt?: Date;
  rowsAffected?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}): Promise<string | null> {
  try {
    const { pool } = await import('../database/connection');
    const durationMs = params.finishedAt
      ? params.finishedAt.getTime() - params.startedAt.getTime()
      : null;

    if (params.status === 'running') {
      // Insert new log entry
      const result = await pool.query(`
        INSERT INTO job_execution_logs (job_name, started_at, status, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [params.jobName, params.startedAt, params.status, JSON.stringify(params.metadata || {})]);
      return result.rows[0]?.id || null;
    } else {
      // Update existing log entry (find by job_name + started_at)
      await pool.query(`
        UPDATE job_execution_logs
        SET status = $1, finished_at = $2, duration_ms = $3, rows_affected = $4, error_message = $5
        WHERE job_name = $6 AND started_at = $7
      `, [params.status, params.finishedAt, durationMs, params.rowsAffected || null, params.errorMessage || null, params.jobName, params.startedAt]);
      return null;
    }
  } catch (err) {
    logger.error('[JobManager] Failed to log job execution:', err);
    return null;
  }
}

/**
 * PR-8B: Stuck Match Finisher job extracted as separate function
 * Wrapped with JobRunner for overlap guard + timeout + metrics
 * Migrated to use MatchOrchestrator for atomic updates
 */
export async function runStuckMatchFinisher(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'stuckMatchFinisher',
      overlapGuard: true,
      advisoryLockKey: 910000000099n, // Using available lock key slot
      timeoutMs: 180000, // 3 minutes
    },
    async (_ctx) => {
      // PR-8B: Migrated to use MatchOrchestrator for atomic updates
      const { pool } = await import('../database/connection');
      const nowTs = Math.floor(Date.now() / 1000);

      // Step 1: SELECT stuck matches (same criteria as before)
      // Matches that are 90+ minutes and started 2+ hours ago
      const client = await pool.connect();
      try {
        const selectQuery = `
          SELECT external_id, minute
          FROM ts_matches
          WHERE status_id IN (${LIVE_STATUSES_SQL})
            AND match_time < $1
            AND (minute >= 90 OR match_time < $2)
        `;
        const result = await client.query(selectQuery, [nowTs - 7200, nowTs - 14400]); // 2 hours, 4 hours

        const stuckMatches = result.rows;

        if (stuckMatches.length === 0) {
          logger.debug('[StuckMatchFinisher] No stuck matches found');
          return;
        }

        // Step 2: Update each match via orchestrator
        let successCount = 0;
        let failCount = 0;

        for (const match of stuckMatches) {
          const matchId = match.external_id;
          const currentMinute = match.minute !== null ? Number(match.minute) : 0;
          const finalMinute = Math.max(currentMinute, 90); // Ensure at least 90 minutes

          // Build update array
          const updates: FieldUpdate[] = [
            {
              field: 'status_id',
              value: 8, // ENDED
              source: 'admin',
              priority: 10, // Highest priority (admin action)
              timestamp: nowTs,
            },
            {
              field: 'minute',
              value: finalMinute,
              source: 'admin',
              priority: 10,
              timestamp: nowTs,
            },
          ];

          try {
            const orchestratorResult = await matchOrchestrator.updateMatch(matchId, updates, 'admin');

            if (orchestratorResult.status === 'success') {
              successCount++;
              logger.debug(`[StuckMatchFinisher] Auto-finished ${matchId} (minute: ${currentMinute} → ${finalMinute})`);
            } else if (orchestratorResult.status === 'rejected_invalid') {
              // PR-8B.1: Invalid matchId (alphanumeric hash collision or malformed ID)
              logger.debug(`[StuckMatchFinisher] Skipped ${matchId}: invalid matchId`);
              failCount++;
            } else if (orchestratorResult.status === 'rejected_immutable') {
              logger.debug(`[StuckMatchFinisher] Skipped ${matchId}: already finished (immutable)`);
              failCount++;
            } else if (orchestratorResult.status === 'rejected_locked') {
              logger.debug(`[StuckMatchFinisher] Skipped ${matchId}: lock busy`);
              failCount++;
            } else {
              logger.warn(`[StuckMatchFinisher] Failed to finish ${matchId}: ${orchestratorResult.status}`);
              failCount++;
            }
          } catch (error: any) {
            logger.error(`[StuckMatchFinisher] Error finishing ${matchId}:`, error);
            failCount++;
          }
        }

        if (successCount > 0) {
          logger.info(`✅ Auto-finished ${successCount} stuck matches (failed: ${failCount})`);
        }
      } finally {
        client.release();
      }
    }
  );
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
    handler: runStuckMatchFinisher, // PR-8A: Use wrapped function
    enabled: true,
    description: 'Auto-finish matches stuck in live status (90+ min or 4+ hours old)',
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
  {
    name: 'Daily Diary Sync (Midnight)',
    schedule: '0 21 * * *', // Daily at 21:00 UTC = 00:00 TSİ (Turkey)
    handler: async () => {
      const { runDailyDiarySync } = await import('./dailyDiarySync.job');
      await runDailyDiarySync();
    },
    enabled: true,
    description: 'Full diary sync at midnight TSİ for new day',
  },
  {
    name: 'Diary Refresh (10min)',
    schedule: '*/10 * * * *', // Every 10 minutes (TheSports API recommendation)
    handler: async () => {
      const { runDailyDiarySync } = await import('./dailyDiarySync.job');
      await runDailyDiarySync();
    },
    enabled: true,
    description: 'Refresh today\'s diary every 10 minutes per TheSports API recommendation',
  },
  {
    name: 'H2H Pre-Sync',
    schedule: '*/30 * * * *', // Every 30 minutes
    handler: async () => {
      const { runH2HPreSync } = await import('./h2hPreSync.job');
      await runH2HPreSync();
    },
    enabled: true,
    description: 'Pre-sync H2H data for NOT_STARTED matches (ensures H2H tab has data before match starts)',
  },
  {
    name: 'Live Stats Sync',
    schedule: '* * * * *', // Every minute
    handler: async () => {
      const { runStatsSync } = await import('./statsSync.job');
      await runStatsSync();
    },
    enabled: true,
    description: 'Phase 6: Sync live match stats from TheSports API to database (proactive caching)',
  },
  {
    name: 'Lineup Pre-Sync',
    schedule: '*/15 * * * *', // Every 15 minutes
    handler: async () => {
      const { runLineupPreSync } = await import('./lineupPreSync.job');
      await runLineupPreSync();
    },
    enabled: true,
    description: 'Phase 7: Pre-fetch lineups for matches starting in next 60 minutes',
  },
  {
    name: 'Telegram Settlement',
    schedule: '*/10 * * * *', // Every 10 minutes
    handler: async () => {
      const { runTelegramSettlement } = await import('./telegramSettlement.job');
      await runTelegramSettlement();
    },
    enabled: true,
    description: 'Settle Telegram published picks for finished matches',
  },
  {
    name: 'Telegram Daily Lists',
    schedule: '0 10 * * *', // Daily at 10:00 AM UTC (13:00 Turkey time)
    handler: async () => {
      const { runTelegramDailyListsJob } = await import('./telegramDailyLists.job');
      await runTelegramDailyListsJob();
    },
    enabled: true,
    description: 'Automated daily prediction lists for Telegram (Over 2.5, BTTS, HT Over 0.5)',
  },
  {
    name: 'Daily Lists Generation',
    schedule: '0 9 * * *', // Daily at 09:00 UTC (12:00 Turkey time / TSİ)
    handler: async () => {
      const { runDailyListsGeneration } = await import('./dailyListsGeneration.job');
      await runDailyListsGeneration();
    },
    enabled: true,
    description: 'Generate and store daily prediction lists to database (runs once per day at noon)',
  },
  {
    name: 'Daily Lists Settlement',
    schedule: '*/15 * * * *', // Every 15 minutes
    handler: async () => {
      const { runDailyListsSettlement } = await import('./dailyListsSettlement.job');
      await runDailyListsSettlement();
    },
    enabled: true,
    description: 'Settle Telegram daily lists by evaluating match results from TheSports API',
  },
  {
    name: 'Job Logs Cleanup',
    schedule: '0 5 * * *', // Daily at 05:00 UTC
    handler: async () => {
      const { runJobLogsCleanup } = await import('./jobLogsCleanup.job');
      await runJobLogsCleanup();
    },
    enabled: true,
    description: 'PHASE-0.1: Delete job execution logs older than 30 days',
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
      const startTime = new Date();
      logger.info(`🔄 Job started: ${job.name}`);

      // PHASE-0: Log job start to database
      await logJobExecution({
        jobName: job.name,
        status: 'running',
        startedAt: startTime,
        metadata: { schedule: job.schedule },
      });

      try {
        await job.handler();
        const finishTime = new Date();
        const duration = finishTime.getTime() - startTime.getTime();
        logger.info(`✅ Job completed: ${job.name} (${duration}ms)`);

        // PHASE-0: Log job success to database
        await logJobExecution({
          jobName: job.name,
          status: 'success',
          startedAt: startTime,
          finishedAt: finishTime,
        });
      } catch (error: any) {
        const finishTime = new Date();
        const duration = finishTime.getTime() - startTime.getTime();
        logger.error(`❌ Job failed: ${job.name} (${duration}ms)`, {
          error: error.message,
          stack: error.stack,
        });

        // PHASE-0: Log job failure to database
        await logJobExecution({
          jobName: job.name,
          status: 'failed',
          startedAt: startTime,
          finishedAt: finishTime,
          errorMessage: error.message,
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

/**
 * Twitter Trends Job
 *
 * Automated daily publication of trend analysis to Twitter/X.
 *
 * SCHEDULE: 06:00 UTC = 09:00 Turkey time
 *
 * Uses same pattern as telegramDailyLists.job.ts:
 * - JobRunner with overlap guard + advisory lock
 * - Kill switch check
 * - Internal API POST
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';
import { logger } from '../utils/logger';
import axios from 'axios';

export async function runTwitterTrendsJob(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'twitterTrendsPublish',
      overlapGuard: true,
      advisoryLockKey: LOCK_KEYS.TWITTER_TRENDS_PUBLISH,
      timeoutMs: 300000, // 5 minutes max
    },
    async (_ctx) => {
      logger.info('[TwitterTrends.Job] 🚀 Starting Twitter trends publish job...');

      // Kill switch check
      if (process.env.TWITTER_KILL_SWITCH === 'true') {
        logger.warn('[TwitterTrends.Job] ⛔ Kill switch active (TWITTER_KILL_SWITCH=true). Skipping.');
        return;
      }

      // Feature flag check
      const isDryRun = process.env.TWITTER_DRY_RUN === 'true';
      const isEnabled = process.env.TWITTER_PUBLISH_ENABLED === 'true';

      if (!isEnabled && !isDryRun) {
        logger.info('[TwitterTrends.Job] ⏸️ Skipping — neither TWITTER_PUBLISH_ENABLED nor TWITTER_DRY_RUN is true.');
        return;
      }

      try {
        const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
        const response = await axios.post(`${baseUrl}/api/twitter/publish/trends`, {}, {
          timeout: 120000,
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.data.success) {
          if (response.data.skipped) {
            logger.info('[TwitterTrends.Job] ⏭️ Skipped', { reason: response.data.skip_reason });
          } else {
            logger.info('[TwitterTrends.Job] ✅ Published successfully', {
              dry_run: response.data.dry_run,
              tweet_count: response.data.tweet_count,
              main_tweet_id: response.data.main_tweet_id,
              elapsed_ms: response.data.elapsed_ms,
            });
          }
        } else {
          logger.warn('[TwitterTrends.Job] ⚠️ Publish returned success=false', {
            error: response.data.error,
          });
        }

      } catch (error: any) {
        logger.error('[TwitterTrends.Job] ❌ Job failed', {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  );
}

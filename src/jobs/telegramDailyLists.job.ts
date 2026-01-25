/**
 * Telegram Daily Lists Job
 *
 * Automated daily publication of prediction lists to Telegram channel.
 *
 * SCHEDULE: Daily at 10:00 AM UTC (13:00 Turkey time)
 *
 * LISTS GENERATED:
 * - Over 2.5 Goals (3-5 matches)
 * - BTTS (3-5 matches)
 * - First Half Over 0.5 (3-5 matches)
 *
 * STRICT RULES:
 * - Only NOT_STARTED matches
 * - Confidence-based filtering
 * - Skip if insufficient data
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';
import { logger } from '../utils/logger';
import axios from 'axios';

export async function runTelegramDailyListsJob(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'telegramDailyLists',
      overlapGuard: true,
      advisoryLockKey: LOCK_KEYS.TELEGRAM_DAILY_LISTS,
      timeoutMs: 300000, // 5 minutes max
    },
    async (_ctx) => {
      logger.info('[TelegramDailyLists.Job] 🚀 Starting daily lists job...');

      try {
        // Call the publish endpoint (using internal request)
        const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
        const response = await axios.post(`${baseUrl}/api/telegram/publish/daily-lists`, {}, {
          timeout: 120000, // 2 minutes timeout
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.data.success) {
          logger.info('[TelegramDailyLists.Job] ✅ Daily lists published successfully', {
            lists_generated: response.data.lists_generated,
            lists_published: response.data.lists_published,
            elapsed_ms: response.data.elapsed_ms,
          });
        } else {
          logger.warn('[TelegramDailyLists.Job] ⚠️ No lists published', {
            message: response.data.message,
            reason: response.data.reason,
          });
        }

      } catch (error: any) {
        logger.error('[TelegramDailyLists.Job] ❌ Job failed', {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  );
}

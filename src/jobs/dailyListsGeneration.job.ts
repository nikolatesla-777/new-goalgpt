/**
 * Daily Lists Generation Job
 *
 * Schedule: Every day at 12:00 PM Istanbul time (09:00 UTC)
 * Purpose: Generate fresh daily prediction lists and store in database
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { refreshDailyLists } from '../services/telegram/dailyLists.service';
import { logger } from '../utils/logger';
import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';

export async function runDailyListsGeneration(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'dailyListsGeneration',
      overlapGuard: true,
      advisoryLockKey: LOCK_KEYS.DAILY_LISTS_GENERATION,
      timeoutMs: 300000, // 5 minutes timeout
    },
    async (_ctx) => {
      logger.info('[DailyListsGeneration] 🚀 Starting daily lists generation...');

      const startTime = Date.now();

      try {
        // Force refresh - generates new lists and saves to database
        const lists = await refreshDailyLists();

        const elapsedMs = Date.now() - startTime;

        if (lists.length === 0) {
          logger.warn('[DailyListsGeneration] ⚠️ NO_ELIGIBLE_MATCHES - No lists generated', {
            elapsed_ms: elapsedMs,
          });
          return;
        }

        logger.info(`[DailyListsGeneration] ✅ Successfully generated ${lists.length} lists`, {
          elapsed_ms: elapsedMs,
          lists: lists.map(l => ({
            market: l.market,
            matches_count: l.matches.length,
            avg_confidence: l.avg_confidence || 0,
          })),
        });

      } catch (error: any) {
        const elapsedMs = Date.now() - startTime;
        logger.error('[DailyListsGeneration] ❌ Generation failed', {
          error: error.message,
          stack: error.stack,
          elapsed_ms: elapsedMs,
        });
        throw error;
      }
    }
  );
}

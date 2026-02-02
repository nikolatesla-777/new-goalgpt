/**
 * Daily Lists Settlement Job
 *
 * AUTO-SETTLEMENT: Evaluates finished matches in daily lists and updates Telegram messages
 *
 * SCHEDULE: Every 15 minutes
 * PURPOSE: Settle daily prediction lists by mapping to TheSports match results
 *
 * PROCESS:
 * 1. Find unsettled lists (settled_at IS NULL, status = 'active')
 * 2. For each list:
 *    - Fetch match results from TheSports (status_id = 8 = ENDED)
 *    - Evaluate each match against market criteria
 *    - Build settlement summary (won/lost/void counts)
 *    - Edit Telegram message with results
 *    - Mark list as settled in database
 *
 * MARKETS SUPPORTED:
 * - OVER_25: Total goals >= 3
 * - OVER_15: Total goals >= 2
 * - BTTS: Both teams scored
 * - HT_OVER_05: Half-time goals >= 1
 * - CORNERS: Total corners >= 10 (configurable)
 * - CARDS: Total cards >= 5 (configurable)
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

import { pool } from '../database/connection';
import { telegramBot } from '../services/telegram/telegram.client';
import {
  settleDailyList,
  formatSettlementMessage,
  getTodayInIstanbul,
  type DailyListRecord,
} from '../services/telegram/dailyListsSettlement.service';
import { logger } from '../utils/logger';
import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';

/**
 * Run daily lists settlement job
 *
 * SAFETY GUARANTEES:
 * - Advisory lock prevents concurrent runs
 * - Connection released before Telegram API call
 * - Settlement marked even if Telegram edit fails
 * - All operations logged for observability
 */
export async function runDailyListsSettlement(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'dailyListsSettlement',
      overlapGuard: true,
      advisoryLockKey: LOCK_KEYS.DAILY_LISTS_SETTLEMENT,
      timeoutMs: 600000, // 10 minutes
    },
    async (_ctx) => {
      logger.info('[DailyListsSettlement] 🚀 Starting settlement job...');

      const client = await pool.connect();
      let unsettledLists: DailyListRecord[] = [];

      try {
        const today = getTodayInIstanbul(); // "2026-01-28"

        logger.info(`[DailyListsSettlement] 📅 Checking lists for dates up to ${today}`);

        // Get unsettled lists for past dates (including today)
        // INCLUDES: Active lists (status='active') and partial lists (status='partial')
        // Note: Active lists may have settled_at timestamp from previous partial settlement
        const result = await client.query<DailyListRecord>(`
          SELECT
            id,
            market,
            list_date,
            matches,
            telegram_message_id,
            channel_id,
            preview,
            settlement_result
          FROM telegram_daily_lists
          WHERE status IN ('active', 'partial')
            AND list_date <= $1
          ORDER BY list_date ASC, market ASC
          LIMIT 100
        `, [today]);

        unsettledLists = result.rows;

        logger.info(`[DailyListsSettlement] 📊 Found ${unsettledLists.length} unsettled lists`);

      } finally {
        // Release connection BEFORE processing loop
        client.release();
      }

      let settledCount = 0;
      let failedCount = 0;

      // Process each list
      for (const list of unsettledLists) {
        const logContext = {
          list_id: list.id,
          market: list.market,
          list_date: list.list_date,
        };

        try {
          logger.info(`[DailyListsSettlement] 🎯 Processing ${list.market} for ${list.list_date}`, logContext);

          // 1. Settle the list (evaluate all matches)
          const settlementResult = await settleDailyList(list);

          // 2. Edit Telegram message (OPTIONAL - only if published to Telegram)
          if (list.telegram_message_id && list.channel_id) {
            const newMessage = formatSettlementMessage(
              list.market,
              settlementResult,
              list.preview || ''
            );

            logger.info(`[DailyListsSettlement] 📡 Editing Telegram message...`, {
              ...logContext,
              telegram_message_id: list.telegram_message_id,
            });

            try {
              await telegramBot.editMessageText(
                list.channel_id,
                list.telegram_message_id,
                newMessage
              );

              logger.info(`[DailyListsSettlement] ✅ Telegram message edited`, logContext);

            } catch (telegramError: any) {
              // Log error but continue (mark as settled even if edit fails)
              logger.error(`[DailyListsSettlement] ⚠️ Failed to edit Telegram message (will still mark as settled)`, {
                ...logContext,
                error: telegramError.message,
              });
            }
          } else {
            logger.info(`[DailyListsSettlement] ⏭️ Skipping Telegram edit (not published to Telegram)`, logContext);
          }

          // 4. Mark as settled in database (acquire NEW connection)
          const updateClient = await pool.connect();
          try {
            // Determine final status: 'settled' if all matches complete, 'partial' if VOID matches remain
            const hasVoidMatches = settlementResult.void > 0;
            const finalStatus = hasVoidMatches ? 'partial' : 'settled';

            await updateClient.query(
              `UPDATE telegram_daily_lists
               SET settled_at = NOW(),
                   status = $1,
                   settlement_result = $2
               WHERE id = $3`,
              [finalStatus, JSON.stringify(settlementResult), list.id]
            );

            logger.info(`[DailyListsSettlement] ✅ List marked as ${finalStatus}`, {
              ...logContext,
              won: settlementResult.won,
              lost: settlementResult.lost,
              void: settlementResult.void,
              total: settlementResult.matches.length,
              status: finalStatus,
              note: hasVoidMatches ? 'Will retry VOID matches in next run' : 'All matches settled'
            });

            settledCount++;

          } finally {
            updateClient.release();
          }

        } catch (err: any) {
          logger.error(`[DailyListsSettlement] ❌ Failed to settle list`, {
            ...logContext,
            error: err.message,
            stack: err.stack,
          });

          failedCount++;

          // Continue to next list
        }
      }

      // Alert system: Check for critical issues
      const totalProcessed = settledCount + failedCount;

      if (totalProcessed > 0) {
        const failureRate = (failedCount / totalProcessed) * 100;

        // CRITICAL: High settlement failure rate
        if (failureRate > 50 && failedCount > 0) {
          logger.error(
            `[DailyListsSettlement] 🚨 CRITICAL: HIGH SETTLEMENT FAILURE RATE`,
            {
              failure_rate: `${failureRate.toFixed(1)}%`,
              failed: failedCount,
              total: totalProcessed,
              message: `${failedCount}/${totalProcessed} lists failed to settle. This requires immediate attention.`,
            }
          );
        } else if (failureRate > 25 && failedCount > 0) {
          logger.warn(
            `[DailyListsSettlement] ⚠️ WARNING: Elevated settlement failure rate`,
            {
              failure_rate: `${failureRate.toFixed(1)}%`,
              failed: failedCount,
              total: totalProcessed,
            }
          );
        }

        // Calculate mapping rate for settled lists
        if (settledCount > 0) {
          try {
            const today = getTodayInIstanbul();
            const mappingQuery = await pool.query(`
              SELECT
                COUNT(*) as total_matches,
                COUNT(CASE WHEN (matches->'match'->>'match_id') IS NOT NULL AND (matches->'match'->>'match_id') != 'null' THEN 1 END) as mapped_matches
              FROM telegram_daily_lists,
                   jsonb_array_elements(matches) as matches
              WHERE list_date = $1
                AND status != 'draft'
            `, [today]);

            const totalMatches = parseInt(mappingQuery.rows[0]?.total_matches || '0', 10);
            const mappedMatches = parseInt(mappingQuery.rows[0]?.mapped_matches || '0', 10);

            if (totalMatches > 0) {
              const mappingRate = (mappedMatches / totalMatches) * 100;

              if (mappingRate < 80) {
                logger.error(
                  `[DailyListsSettlement] 🚨 CRITICAL: LOW MAPPING RATE`,
                  {
                    mapping_rate: `${mappingRate.toFixed(1)}%`,
                    mapped: mappedMatches,
                    total: totalMatches,
                    unmapped: totalMatches - mappedMatches,
                    message: `Only ${mappingRate.toFixed(1)}% of matches were mapped to TheSports. ` +
                             `This will prevent proper settlement. Check leagues_registry.json and team name matching.`,
                  }
                );
              } else if (mappingRate < 90) {
                logger.warn(
                  `[DailyListsSettlement] ⚠️ WARNING: Below-target mapping rate`,
                  {
                    mapping_rate: `${mappingRate.toFixed(1)}%`,
                    mapped: mappedMatches,
                    total: totalMatches,
                    target: '95%+',
                  }
                );
              }
            }
          } catch (mappingError: any) {
            logger.error(`[DailyListsSettlement] ❌ Failed to calculate mapping rate:`, {
              error: mappingError.message,
            });
          }
        }
      }

      logger.info(`[DailyListsSettlement] ✅ Settlement job completed`, {
        total_lists: unsettledLists.length,
        settled: settledCount,
        failed: failedCount,
        success_rate: totalProcessed > 0 ? `${((settledCount / totalProcessed) * 100).toFixed(1)}%` : 'N/A',
      });
    }
  );
}
